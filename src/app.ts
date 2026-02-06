/**
 * Express application setup
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { authRoutes, userRoutes, postRoutes, healthRoutes } from './routes/index.js';
import { openApiSpec } from './openapi.js';

export function createApp() {
  const app = express();

  // ─── Global Middleware ─────────────────────────────
  app.use(helmet());
  app.use(cors({ origin: config.cors.origin }));
  app.use(express.json({ limit: '10mb' }));
  app.use(requestLogger);

  // ─── API Documentation ────────────────────────────
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // ─── Routes ───────────────────────────────────────
  app.use('/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/posts', postRoutes);

  // ─── Error Handler (must be last) ─────────────────
  app.use(errorHandler);

  return app;
}
