import 'dotenv/config';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifySecureSession from '@fastify/secure-session';
import fastifyMultipart from '@fastify/multipart';
import oauthPlugin from '@fastify/oauth2';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createWriteStream } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { checkDatabaseConnection, runMigrations } from './lib/db.js';
import { findOrCreateUserFromOAuth } from './lib/auth-service.js';
import { createMediaRecord, createMediaAsset, calculateSHA256 } from './lib/media-service.js';
import { findOrCreateDefaultCollection, addMediaToCollection, getDefaultCollectionWithMedia, getCollectionWithMedia, createCollection, getUserCollections } from './lib/collection-service.js';
import pool from './lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({
  logger: true
});

// Register cookie support
fastify.register(fastifyCookie);

// Register multipart for file uploads
fastify.register(fastifyMultipart, {
  limits: {
    files: 1,
    fileSize: Infinity
  }
});

// Register secure session
fastify.register(fastifySecureSession, {
  secret: process.env.SESSION_SECRET,
  salt: 'mq9hDxBVDbspDR6n',
  cookie: {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 86400 * 1000 // 1 day
  }
});

// Register Google OAuth
fastify.register(oauthPlugin, {
  name: 'googleOAuth2',
  credentials: {
    client: {
      id: process.env.GOOGLE_CLIENT_ID,
      secret: process.env.GOOGLE_CLIENT_SECRET
    },
    auth: oauthPlugin.GOOGLE_CONFIGURATION
  },
  startRedirectPath: '/auth/google',
  callbackUri: process.env.CALLBACK_URL,
  scope: ['profile', 'email']
});

// Auth routes
fastify.get('/auth/google/callback', async (request, reply) => {
  try {
    fastify.log.info('Starting OAuth callback');
    const { token } = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
    fastify.log.info('Token received successfully');
    
    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${token.access_token}`
      }
    });
    
    if (!userInfoResponse.ok) {
      throw new Error(`Google API error: ${userInfoResponse.status} ${userInfoResponse.statusText}`);
    }
    
    const googleProfile = await userInfoResponse.json();
    fastify.log.info({ email: googleProfile.email }, 'User info retrieved');
    
    // Find or create user in database
    const user = await findOrCreateUserFromOAuth({
      provider: 'google',
      providerId: googleProfile.id,
      email: googleProfile.email,
      name: googleProfile.name,
      picture: googleProfile.picture,
      rawProfile: googleProfile
    });
    
    fastify.log.info({ userId: user.id, email: user.email }, 'User authenticated');
    
    // Store minimal user info in session
    request.session.set('user', {
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url
    });
    
    fastify.log.info('Session set successfully');
    reply.redirect('/');
  } catch (error) {
    fastify.log.error({ error: error.message, stack: error.stack }, 'OAuth callback failed');
    reply.redirect('/?error=auth_failed');
  }
});

// Check auth status
fastify.get('/api/auth/status', async (request, reply) => {
  const sessionUser = request.session.get('user');
  
  if (!sessionUser || !sessionUser.userId) {
    return { authenticated: false };
  }
  
  try {
    // Fetch fresh user data from database
    const [users] = await pool.query(
      'SELECT id, email, display_name, avatar_url, status FROM users WHERE id = ? AND status = "active"',
      [sessionUser.userId]
    );
    
    if (users.length === 0) {
      // User not found or not active - clear session
      request.session.delete();
      return { authenticated: false };
    }
    
    const user = users[0];
    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name,
        picture: user.avatar_url
      }
    };
  } catch (error) {
    fastify.log.error({ error: error.message }, 'Error fetching user from database');
    return { authenticated: false };
  }
});

// Logout
fastify.post('/api/auth/logout', async (request, reply) => {
  request.session.delete();
  return { success: true };
});

// Get all user collections
fastify.get('/api/collections', async (request, reply) => {
  // Check authentication
  const sessionUser = request.session.get('user');
  if (!sessionUser) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const collections = await getUserCollections(sessionUser.userId);
  return collections;
});

// Create new collection
fastify.post('/api/collections', async (request, reply) => {
  // Check authentication
  const sessionUser = request.session.get('user');
  if (!sessionUser) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const { kind, title, description } = request.body;
  
  if (!title) {
    return reply.code(400).send({ error: 'title is required' });
  }

  const collection = await createCollection({
    userId: sessionUser.userId,
    kind: 'stack',
    title,
    description
  });
  
  return collection;
});

// Get collection by ID with media
fastify.get('/api/collections/:id', async (request, reply) => {
  // Check authentication
  const sessionUser = request.session.get('user');
  if (!sessionUser) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const collectionId = parseInt(request.params.id);
  if (isNaN(collectionId)) {
    return reply.code(400).send({ error: 'Invalid collection ID' });
  }

  const collection = await getCollectionWithMedia(collectionId, sessionUser.userId);
  if (!collection) {
    return reply.code(404).send({ error: 'Collection not found' });
  }

  return collection;
});

// Get default collection with media
fastify.get('/api/collections/default', async (request, reply) => {
  // Check authentication
  const sessionUser = request.session.get('user');
  if (!sessionUser) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const collection = await getDefaultCollectionWithMedia(sessionUser.userId);
  return collection;
});

// Upload endpoint
fastify.post('/api/media/upload', async (request, reply) => {
  // Check authentication
  const sessionUser = request.session.get('user');
  if (!sessionUser || !sessionUser.userId) {
    return reply.code(401).send({ error: 'Authentication required' });
  }

  try {
    const data = await request.file();
    const collectionId = data.fields.collectionId?.value;
    
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    // Validate mime type
    if (!data.mimetype.startsWith('image/')) {
      return reply.code(400).send({ error: 'Only image files are allowed' });
    }

    // Read file to buffer once
    const buffer = await data.toBuffer();
    
    // Get file metadata using sharp
    const metadata = await sharp(buffer).metadata();
    
    // Create media record
    const sha256 = createHash('sha256').update(buffer).digest();
    const media = await createMediaRecord({
      ownerUserId: sessionUser.userId,
      type: 'image',
      originalFilename: data.filename,
      mimeType: data.mimetype,
      bytes: buffer.length,
      sha256: sha256,
      width: metadata.width,
      height: metadata.height
    });

    // Setup output directory
    const uploadsPath = process.env.UPLOADS_PATH || join(__dirname, 'uploads');
    const processedDir = join(uploadsPath, 'processed', 'i', media.publicId);
    await mkdir(processedDir, { recursive: true });
    
    // Define variants to generate
    const variants = [
      { name: '960', width: 960 },
      { name: '640', width: 640 },
      { name: 'original', width: null } // Full size
    ];

    // Generate all variants
    for (const variant of variants) {
      const sharpInstance = sharp(buffer).webp({ quality: 85 });
      
      // Resize if width specified
      if (variant.width) {
        sharpInstance.resize(variant.width, null, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }
      
      const processedBuffer = await sharpInstance.toBuffer();
      const variantMetadata = await sharp(processedBuffer).metadata();
      
      // Save file
      const filename = `${variant.name}.webp`;
      const filePath = join(processedDir, filename);
      await writeFile(filePath, processedBuffer);
      
      // Create asset record
      const relativePath = `i/${media.publicId}/${filename}`;
      await createMediaAsset({
        mediaId: media.id,
        variant: variant.name,
        format: 'webp',
        path: relativePath,
        bytes: processedBuffer.length,
        width: variantMetadata.width,
        height: variantMetadata.height
      });
    }

    // Add to collection
    let targetCollectionId = collectionId;
    
    if (!targetCollectionId) {
      // No collection specified, use default
      const defaultCollection = await findOrCreateDefaultCollection(sessionUser.userId);
      targetCollectionId = defaultCollection.id;
    }
    
    await addMediaToCollection(targetCollectionId, media.id);

    fastify.log.info({ mediaId: media.id, publicId: media.publicId }, 'Media uploaded successfully');

    return {
      success: true,
      publicId: media.publicId,
      mediaId: media.id,
      url: `/m/i/${media.publicId}/960.webp`
    };

  } catch (error) {
    fastify.log.error({ error: error.message, stack: error.stack }, 'Upload failed');
    return reply.code(500).send({ error: 'Upload failed' });
  }
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  const dbStatus = await checkDatabaseConnection();
  
  return {
    status: dbStatus.status === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus
  };
});

// Serve media files from uploads/processed
const uploadsPath = process.env.UPLOADS_PATH || join(__dirname, 'uploads');
fastify.register(fastifyStatic, {
  root: join(uploadsPath, 'processed'),
  prefix: '/m/',
  decorateReply: false
});

// Serve static files from dist directory
fastify.register(fastifyStatic, {
  root: join(__dirname, 'dist'),
  prefix: '/'
});

// Start server
// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    console.log(`Server listening on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
