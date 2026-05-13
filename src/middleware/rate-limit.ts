/**
 * Rate-limit middleware (per-IP, sliding-window via express-rate-limit).
 *
 * Closes CodeQL js/missing-rate-limiting findings on auth/posts/users routes.
 *
 * Standard policy:
 *   - Auth endpoints (login, register): 60 req/min/IP
 *   - Read endpoints (GET): 300 req/min/IP
 *   - Write endpoints (POST/PATCH/DELETE): 60 req/min/IP
 *
 * Override via env: RATE_LIMIT_AUTH_MAX, RATE_LIMIT_READ_MAX, RATE_LIMIT_WRITE_MAX.
 *
 * Note: existing webhook routes (review/pr-webhook.ts, linear/github-webhook.ts)
 * have their own local rate-limiter implementations with different shapes.
 * Not refactored here — out of scope. This file is for the new HTTP-API routes.
 */
import type { Request, Response, NextFunction } from 'express';
import rateLimitLib, { MemoryStore, type RateLimitRequestHandler } from 'express-rate-limit';

/**
 * Extract the client IP, preferring X-Forwarded-For (first hop) when present
 * (this service is deployed behind a proxy / load balancer).
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  if (typeof forwardedValue === 'string' && forwardedValue.trim().length > 0) {
    return forwardedValue.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}

// Registry of every limiter created via `rateLimit()` so test setup can
// reset their in-memory state between tests. Without this hook the
// singletons accumulate request history across the test run and trip
// 429s mid-suite.
const LIMITER_RESETS = new Set<() => void>();

/**
 * Express middleware that applies a per-IP rate limit. Use as router-level
 * or per-route middleware:
 *
 *   router.post('/login', rateLimit(60, 60_000), validate({ body }), handler);
 */
export function rateLimit(maxRequests: number, windowMs: number): RateLimitRequestHandler {
  const store = new MemoryStore();
  const limiter = rateLimitLib({
    windowMs,
    limit: maxRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store,
    keyGenerator: (req: Request) => getClientIp(req),
    handler: (_req: Request, res: Response, _next: NextFunction, options) => {
      const retryAfterSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: 'Too many requests',
        retryAfterSeconds,
      });
    },
  });
  LIMITER_RESETS.add(() => store.resetAll());
  return limiter;
}

/**
 * Test-only: clear in-memory state for every limiter created via
 * `rateLimit`. Routes register limiters at module-load time, so without
 * this hook the singletons accumulate request history across the entire
 * test run and trip 429s mid-suite.
 *
 * Note: express-rate-limit's MemoryStore doesn't expose a global clear,
 * so we replace the underlying store on each registered limiter via the
 * same factory pattern we recorded above.
 */
export function __resetAllRateLimiters(): void {
  for (const reset of LIMITER_RESETS) reset();
}

/** Standard policy presets (sliding 1-minute window). */
export const ONE_MINUTE = 60_000;
export const AUTH_RATE_LIMIT = Number(process.env.RATE_LIMIT_AUTH_MAX) || 60;
export const READ_RATE_LIMIT = Number(process.env.RATE_LIMIT_READ_MAX) || 300;
export const WRITE_RATE_LIMIT = Number(process.env.RATE_LIMIT_WRITE_MAX) || 60;
