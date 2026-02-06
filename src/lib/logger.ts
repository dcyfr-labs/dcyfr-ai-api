/**
 * Logger - pino-based structured logging
 */
import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.log.level,
  transport:
    config.env === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
