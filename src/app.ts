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
import { authRoutes, userRoutes, postRoutes, healthRoutes, webhookRoutes, deviceRoutes, securityScanRoutes } from './routes/index.js';
import { createLinearGithubWebhookRouter } from './routes/linear/github-webhook.js';
import { createReviewGithubWebhookRouter } from './routes/review/pr-webhook.js';
import { openApiSpec } from './openapi.js';

export function createApp() {
  const app = express();

  // ─── Global Middleware ─────────────────────────────
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, Postman, server-to-server)
      if (!origin) return callback(null, true);

      const allowedOrigins = config.cors.origin;
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
  // Capture raw body for HMAC signature validation on webhook routes
  app.use(express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody: string }).rawBody = buf.toString();
    },
  }));
  app.use(requestLogger);

  // ─── API Documentation ────────────────────────────
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // ─── Routes ───────────────────────────────────────
  app.use('/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/security-scans', securityScanRoutes);
  app.use('/webhooks', webhookRoutes);
  app.use('/api/linear-sync', createLinearGithubWebhookRouter());
  app.use('/api/review', createReviewGithubWebhookRouter());

  // ─── Error Handler (must be last) ─────────────────
  app.use(errorHandler);

  return app;
}
