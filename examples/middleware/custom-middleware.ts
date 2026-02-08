/**
 * Custom Middleware Examples
 * 
 * Demonstrates how to create reusable middleware
 */

import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';

/**
 * Rate limiting middleware (simple in-memory implementation)
 */
export function createRateLimiter(
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) {
  const requests = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();

    // Get existing requests for this IP
    const ipRequests = requests.get(ip) || [];

    // Filter out expired requests
    const validRequests = ipRequests.filter((time) => now - time < windowMs);

    // Check limit
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    }

    // Add this request
    validRequests.push(now);
    requests.set(ip, validRequests);

    next();
  };
}

/**
 * Request timing middleware
 */
export function requestTimer(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();

    // Capture original end method
    const originalEnd = res.end;

    // Override end to log timing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.end = function (...args: any[]) {
      const duration = performance.now() - start;

      logger.info({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration.toFixed(2)}ms`,
      });

      // Call original end
      return originalEnd.apply(res, args);
    };

    next();
  };
}

/**
 * Request ID middleware
 */
export function requestId() {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}

/**
 * API version middleware
 */
export function apiVersion(version: string = 'v1') {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-API-Version', version);
    next();
  };
}

/**
 * Example usage in Express app:
 * 
 * ```typescript
 * import { createRateLimiter, requestTimer, requestId, apiVersion } from './middleware';
 * import { logger } from './lib/logger';
 * 
 * app.use(requestId());
 * app.use(apiVersion('v1'));
 * app.use(requestTimer(logger));
 * app.use('/api', createRateLimiter(100, 15 * 60 * 1000));
 * ```
 */
