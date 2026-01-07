import 'dotenv/config';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifySecureSession from '@fastify/secure-session';
import oauthPlugin from '@fastify/oauth2';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { checkDatabaseConnection } from './lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({
  logger: true
});

// Register cookie support
fastify.register(fastifyCookie);

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
    
    const userInfo = await userInfoResponse.json();
    fastify.log.info({ email: userInfo.email }, 'User info retrieved');
    
    // Store user info in session
    request.session.set('user', {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture
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
  const user = request.session.get('user');
  if (user) {
    return { authenticated: true, user };
  }
  return { authenticated: false };
});

// Logout
fastify.post('/api/auth/logout', async (request, reply) => {
  request.session.delete();
  return { success: true };
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
