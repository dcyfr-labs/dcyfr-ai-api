/**
 * Application configuration
 */
import 'dotenv/config';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET environment variable is required in production. ' +
        'Please set a strong secret value.'
      );
    }
    // Development fallback with clear warning
    console.warn(
      '⚠️  WARNING: Using insecure development JWT secret. ' +
      'Set JWT_SECRET environment variable for production use.'
    );
    return 'dev-secret-INSECURE-for-development-only';
  }
  
  return secret;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  db: {
    url: process.env.DATABASE_URL || './data/dev.db',
  },

  jwt: {
    secret: getJwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  apiKeys: (process.env.API_KEYS || '').split(',').filter(Boolean),

  cors: {
    // Parse comma-separated origins, fallback to localhost for development
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;
