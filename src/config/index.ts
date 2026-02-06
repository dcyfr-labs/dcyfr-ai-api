/**
 * Application configuration
 */
import 'dotenv/config';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  db: {
    url: process.env.DATABASE_URL || './data/dev.db',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  apiKeys: (process.env.API_KEYS || '').split(',').filter(Boolean),

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;
