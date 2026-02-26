import 'dotenv/config';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifySecureSession from '@fastify/secure-session';
import fastifyMultipart from '@fastify/multipart';
import oauthPlugin from '@fastify/oauth2';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { checkDatabaseConnection, runMigrations } from './lib/db.js';
import { findOrCreateUserFromOAuth } from './lib/auth-service.js';
import { createMediaRecord, createMediaAsset, calculateSHA256 } from './lib/media-service.js';
import { findOrCreateDefaultCollection, addMediaToCollection, getDefaultCollectionWithMedia, getCollectionWithMedia, createCollection, getUserCollections, updateCollection, deleteCollection } from './lib/collection-service.js';
import pool from './lib/db.js';
import { uploadObject, deletePrefix, getPublicUrl } from './lib/r2-service.js';

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
  callbackUri: process.env.GOOGLE_CALLBACK_URL,
  scope: ['profile', 'email']
});

// Register GitHub OAuth
fastify.register(oauthPlugin, {
  name: 'githubOAuth2',
  credentials: {
    client: {
      id: process.env.GITHUB_CLIENT_ID,
      secret: process.env.GITHUB_CLIENT_SECRET
    },
    auth: oauthPlugin.GITHUB_CONFIGURATION
  },
  startRedirectPath: '/auth/github',
  callbackUri: process.env.GITHUB_CALLBACK_URL,
  scope: ['user:email']
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

// GitHub OAuth callback
fastify.get('/auth/github/callback', async (request, reply) => {
  try {
    fastify.log.info('Starting GitHub OAuth callback');
    const { token } = await fastify.githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
    fastify.log.info('GitHub token received successfully');

    // Get user info from GitHub
    const userInfoResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'cdn-app'
      }
    });

    if (!userInfoResponse.ok) {
      throw new Error(`GitHub API error: ${userInfoResponse.status} ${userInfoResponse.statusText}`);
    }

    const githubProfile = await userInfoResponse.json();
    let email = githubProfile.email;

    // If email is private, fetch from /user/emails endpoint
    if (!email) {
      fastify.log.info('Email not public, fetching from /user/emails');
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'cdn-app'
        }
      });

      if (!emailsResponse.ok) {
        throw new Error(`GitHub emails API error: ${emailsResponse.status} ${emailsResponse.statusText}`);
      }

      const emails = await emailsResponse.json();
      const primaryEmail = emails.find(e => e.primary && e.verified);
      if (!primaryEmail) {
        throw new Error('No verified primary email found on GitHub account');
      }
      email = primaryEmail.email;
    }

    fastify.log.info({ email }, 'GitHub user info retrieved');

    // Find or create user in database
    const user = await findOrCreateUserFromOAuth({
      provider: 'github',
      providerId: String(githubProfile.id),
      email,
      name: githubProfile.name || githubProfile.login,
      picture: githubProfile.avatar_url,
      rawProfile: githubProfile
    });

    fastify.log.info({ userId: user.id, email: user.email }, 'GitHub user authenticated');

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
    fastify.log.error({ error: error.message, stack: error.stack }, 'GitHub OAuth callback failed');
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

// Update collection
fastify.patch('/api/collections/:id', async (request, reply) => {
  // Check authentication
  const sessionUser = request.session.get('user');
  if (!sessionUser) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const collectionId = parseInt(request.params.id);
  if (isNaN(collectionId)) {
    return reply.code(400).send({ error: 'Invalid collection ID' });
  }

  const { title, description } = request.body;
  
  if (!title || !title.trim()) {
    return reply.code(400).send({ error: 'title is required' });
  }

  const updatedCollection = await updateCollection(collectionId, sessionUser.userId, {
    title: title.trim(),
    description: description ? description.trim() : null
  });
  
  if (!updatedCollection) {
    return reply.code(404).send({ error: 'Collection not found' });
  }

  return updatedCollection;
});

// Delete collection
fastify.delete('/api/collections/:id', async (request, reply) => {
  // Check authentication
  const sessionUser = request.session.get('user');
  if (!sessionUser) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const collectionId = parseInt(request.params.id);
  if (isNaN(collectionId)) {
    return reply.code(400).send({ error: 'Invalid collection ID' });
  }

  const result = await deleteCollection(collectionId, sessionUser.userId);
  
  if (!result.success) {
    return reply.code(400).send({ error: result.error });
  }

  return { success: true };
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

    // Determine R2 key prefix
    let mediaTypePrefix = 'i'; // images
    if (mediaType === 'archive') mediaTypePrefix = 'a';
    else if (mediaType === 'audio') mediaTypePrefix = 'au';
    else if (mediaType === 'video') mediaTypePrefix = 'v';

    if (isZip) {
      // For zip files, upload the original to R2
      const filename = data.filename;
      const key = `${mediaTypePrefix}/${media.publicId}/${filename}`;
      await uploadObject(key, buffer, data.mimetype);

      await createMediaAsset({
        mediaId: media.id,
        variant: 'original',
        format: 'zip',
        path: key,
        bytes: buffer.length,
        width: null,
        height: null
      });
    } else if (isAudio) {
      // For audio files, upload the original to R2
      const filename = data.filename;
      const key = `${mediaTypePrefix}/${media.publicId}/${filename}`;
      await uploadObject(key, buffer, data.mimetype);

      await createMediaAsset({
        mediaId: media.id,
        variant: 'original',
        format: 'mp3',
        path: key,
        bytes: buffer.length,
        width: null,
        height: null
      });
    } else if (isVideo) {
      // For video files, upload the original to R2
      const filename = data.filename;
      const key = `${mediaTypePrefix}/${media.publicId}/${filename}`;
      await uploadObject(key, buffer, data.mimetype);

      await createMediaAsset({
        mediaId: media.id,
        variant: 'original',
        format: 'mp4',
        path: key,
        bytes: buffer.length,
        width: null,
        height: null
      });
    } else {
      // For images, generate all size variants and upload each to R2
      const variants = [
        { name: '960', width: 960 },
        { name: '640', width: 640 },
        { name: 'original', width: null } // Full size
      ];

      for (const variant of variants) {
        const sharpInstance = sharp(buffer).webp({ quality: 85 });

        if (variant.width) {
          sharpInstance.resize(variant.width, null, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }

        const processedBuffer = await sharpInstance.toBuffer();
        const variantMetadata = await sharp(processedBuffer).metadata();

        const filename = `${variant.name}.webp`;
        const key = `${mediaTypePrefix}/${media.publicId}/${filename}`;
        await uploadObject(key, processedBuffer, 'image/webp');

        await createMediaAsset({
          mediaId: media.id,
          variant: variant.name,
          format: 'webp',
          path: key,
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

    let previewUrl = getPublicUrl(`${mediaTypePrefix}/${media.publicId}/960.webp`);
    if (isZip) previewUrl = getPublicUrl(`${mediaTypePrefix}/${media.publicId}/${encodeURIComponent(data.filename)}`);
    else if (isAudio) previewUrl = getPublicUrl(`${mediaTypePrefix}/${media.publicId}/${encodeURIComponent(data.filename)}`);
    else if (isVideo) previewUrl = getPublicUrl(`${mediaTypePrefix}/${media.publicId}/${encodeURIComponent(data.filename)}`);    

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

    // Delete files from R2
    const typePrefix = media.type === 'image' ? 'i' : 
                       media.type === 'archive' ? 'a' : 
                       media.type === 'audio' ? 'au' : 'v';
    const r2Prefix = `${typePrefix}/${media.public_id}/`;
    
    try {
      const count = await deletePrefix(r2Prefix);
      fastify.log.info({ mediaId, publicId: media.public_id, objectsDeleted: count }, 'Media files deleted from R2');
    } catch (error) {
      fastify.log.warn({ error: error.message, mediaId }, 'Failed to delete media files from R2');
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

// Redirect /m/* requests to R2 public URL (backward-compatible media serving)
fastify.get('/m/*', async (request, reply) => {
  const key = request.params['*'];
  return reply.redirect(getPublicUrl(key));
});

// Serve static files from dist directory
fastify.register(fastifyStatic, {
  root: join(__dirname, 'dist'),
  prefix: '/'
});

// SPA fallback - serve index.html for all non-API routes
fastify.setNotFoundHandler((request, reply) => {
  // If it's an API request, return 404 JSON
  if (request.url.startsWith('/api/') || request.url.startsWith('/auth/') || request.url.startsWith('/m/')) {
    return reply.code(404).send({
      message: `Route ${request.method}:${request.url} not found`,
      error: 'Not Found',
      statusCode: 404
    });
  }
  
  // Otherwise, serve index.html for client-side routing
  return reply.sendFile('index.html');
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
