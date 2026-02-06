/**
 * Server entry point
 */
import { createApp } from './app.js';
import { config } from './config/index.js';
import { migrate } from './db/migrate.js';
import { sqliteDb } from './db/connection.js';
import { logger } from './lib/logger.js';

// Run migrations
migrate(sqliteDb);

// Start server
const app = createApp();

app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'Server started');
  logger.info(`API docs: http://localhost:${config.port}/docs`);
  logger.info(`Health:   http://localhost:${config.port}/health`);
});
