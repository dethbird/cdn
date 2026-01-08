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
import { mkdir, writeFile, rm } from 'fs/promises';
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
    const customTitle = data.fields.title?.value;
    const customDescription = data.fields.description?.value;
    
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    // Validate mime type
    const isImage = data.mimetype.startsWith('image/');
    const isZip = data.mimetype === 'application/zip' || data.mimetype === 'application/x-zip-compressed';
    const isAudio = data.mimetype === 'audio/mpeg' || data.mimetype === 'audio/mp3';
    const isVideo = data.mimetype === 'video/mp4';
    
    if (!isImage && !isZip && !isAudio && !isVideo) {
      return reply.code(400).send({ error: 'Only image, audio (MP3), video (MP4), and zip files are allowed' });
    }

    // Read file to buffer once
    const buffer = await data.toBuffer();
    
    // Determine media type and handle accordingly
    let mediaType = 'image';
    if (isZip) mediaType = 'archive';
    else if (isAudio) mediaType = 'audio';
    else if (isVideo) mediaType = 'video';
    
    let metadata = null;
    let width = null;
    let height = null;
    
    if (isImage) {
      // Get image metadata using sharp
      metadata = await sharp(buffer).metadata();
      width = metadata.width;
      height = metadata.height;
    }
    
    // Create media record
    const sha256 = createHash('sha256').update(buffer).digest();
    const media = await createMediaRecord({
      ownerUserId: sessionUser.userId,
      type: mediaType,
      originalFilename: data.filename,
      mimeType: data.mimetype,
      bytes: buffer.length,
      sha256: sha256,
      width: width,
      height: height,
      title: customTitle,
      caption: customDescription
    });

    // Setup output directory
    const uploadsPath = process.env.UPLOADS_PATH || join(__dirname, 'uploads');
    let mediaTypePrefix = 'i'; // images
    if (mediaType === 'archive') mediaTypePrefix = 'a';
    else if (mediaType === 'audio') mediaTypePrefix = 'au';
    else if (mediaType === 'video') mediaTypePrefix = 'v';
    
    const processedDir = join(uploadsPath, 'processed', mediaTypePrefix, media.publicId);
    await mkdir(processedDir, { recursive: true });
    
    if (isZip) {
      // For zip files, just save the original
      const filename = 'original.zip';
      const filePath = join(processedDir, filename);
      await writeFile(filePath, buffer);
      
      // Create asset record
      const relativePath = `${mediaTypePrefix}/${media.publicId}/${filename}`;
      await createMediaAsset({
        mediaId: media.id,
        variant: 'original',
        format: 'zip',
        path: relativePath,
        bytes: buffer.length,
        width: null,
        height: null
      });
    } else if (isAudio) {
      // For audio files, save as MP3
      const filename = 'original.mp3';
      const filePath = join(processedDir, filename);
      await writeFile(filePath, buffer);
      
      // Create asset record
      const relativePath = `${mediaTypePrefix}/${media.publicId}/${filename}`;
      await createMediaAsset({
        mediaId: media.id,
        variant: 'original',
        format: 'mp3',
        path: relativePath,
        bytes: buffer.length,
        width: null,
        height: null
      });
    } else if (isVideo) {
      // For video files, save as MP4
      const filename = 'original.mp4';
      const filePath = join(processedDir, filename);
      await writeFile(filePath, buffer);
      
      // Create asset record
      const relativePath = `${mediaTypePrefix}/${media.publicId}/${filename}`;
      await createMediaAsset({
        mediaId: media.id,
        variant: 'original',
        format: 'mp4',
        path: relativePath,
        bytes: buffer.length,
        width: null,
        height: null
      });
    } else {
      // For images, generate variants
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
        const relativePath = `${mediaTypePrefix}/${media.publicId}/${filename}`;
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
    }

    // Add to collection
    let targetCollectionId = collectionId;
    
    if (!targetCollectionId) {
      // No collection specified, use default
      const defaultCollection = await findOrCreateDefaultCollection(sessionUser.userId);
      targetCollectionId = defaultCollection.id;
    }
    
    await addMediaToCollection(targetCollectionId, media.id);

    fastify.log.info({ mediaId: media.id, publicId: media.publicId, type: mediaType }, 'Media uploaded successfully');

    let previewUrl = `/m/${mediaTypePrefix}/${media.publicId}/960.webp`;
    if (isZip) previewUrl = `/m/${mediaTypePrefix}/${media.publicId}/original.zip`;
    else if (isAudio) previewUrl = `/m/${mediaTypePrefix}/${media.publicId}/original.mp3`;
    else if (isVideo) previewUrl = `/m/${mediaTypePrefix}/${media.publicId}/original.mp4`;

    return {
      success: true,
      publicId: media.publicId,
      mediaId: media.id,
      type: mediaType,
      url: previewUrl
    };

  } catch (error) {
    fastify.log.error({ error: error.message, stack: error.stack }, 'Upload failed');
    return reply.code(500).send({ error: 'Upload failed' });
  }
});

// Update media metadata
fastify.patch('/api/media/:id', async (request, reply) => {
  const sessionUser = request.session.get('user');
  if (!sessionUser || !sessionUser.userId) {
    return reply.code(401).send({ error: 'Authentication required' });
  }

  const mediaId = parseInt(request.params.id);
  if (isNaN(mediaId)) {
    return reply.code(400).send({ error: 'Invalid media ID' });
  }

  const { title, caption } = request.body;

  fastify.log.info({ mediaId, title, caption, userId: sessionUser.userId }, 'Updating media');

  try {
    // Verify the media belongs to the user
    const [mediaRows] = await pool.query(
      'SELECT id FROM media WHERE id = ? AND owner_user_id = ?',
      [mediaId, sessionUser.userId]
    );

    if (mediaRows.length === 0) {
      fastify.log.warn({ mediaId, userId: sessionUser.userId }, 'Media not found for update');
      return reply.code(404).send({ error: 'Media not found' });
    }

    // Update the media
    await pool.query(
      'UPDATE media SET title = ?, caption = ?, updated_at = NOW(3) WHERE id = ?',
      [title || null, caption || null, mediaId]
    );

    fastify.log.info({ mediaId }, 'Media updated successfully');
    return { success: true, mediaId };
  } catch (error) {
    fastify.log.error({ error: error.message, mediaId }, 'Failed to update media');
    return reply.code(500).send({ error: 'Failed to update media' });
  }
});

// Delete media
fastify.delete('/api/media/:id', async (request, reply) => {
  const sessionUser = request.session.get('user');
  if (!sessionUser || !sessionUser.userId) {
    return reply.code(401).send({ error: 'Authentication required' });
  }

  const mediaId = parseInt(request.params.id);
  if (isNaN(mediaId)) {
    return reply.code(400).send({ error: 'Invalid media ID' });
  }

  try {
    // Get media info and verify ownership
    const [mediaRows] = await pool.query(
      'SELECT public_id, type FROM media WHERE id = ? AND owner_user_id = ?',
      [mediaId, sessionUser.userId]
    );

    if (mediaRows.length === 0) {
      return reply.code(404).send({ error: 'Media not found' });
    }

    const media = mediaRows[0];
    
    // Delete from database (cascade will handle media_asset and collection_item)
    await pool.query('DELETE FROM media WHERE id = ?', [mediaId]);

    // Delete files from disk
    const typePrefix = media.type === 'image' ? 'i' : 
                       media.type === 'archive' ? 'a' : 
                       media.type === 'audio' ? 'au' : 'v';
    const mediaDir = join(uploadsPath, 'processed', typePrefix, media.public_id);
    
    try {
      await rm(mediaDir, { recursive: true, force: true });
      fastify.log.info({ mediaId, publicId: media.public_id }, 'Media files deleted');
    } catch (error) {
      fastify.log.warn({ error: error.message, mediaId }, 'Failed to delete media files');
    }

    return { success: true, mediaId };
  } catch (error) {
    fastify.log.error({ error: error.message }, 'Failed to delete media');
    return reply.code(500).send({ error: 'Failed to delete media' });
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
