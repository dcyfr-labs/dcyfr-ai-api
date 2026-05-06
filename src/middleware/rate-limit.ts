/**
 * Rate-limit middleware (in-memory, per-IP, sliding-window).
 *
 * Closes CodeQL js/missing-rate-limiting findings on auth/posts/users routes.
 *
 * Limits configured via the `rateLimit()` factory at route registration time.
 * Standard policy across this service:
 *   - Auth endpoints (login, register, password reset): 60 req/min/IP
 *   - Read endpoints (GET): 300 req/min/IP
 *   - Write endpoints (POST/PATCH/DELETE on resources): 60 req/min/IP
 *
 * Override via env: RATE_LIMIT_AUTH_MAX, RATE_LIMIT_READ_MAX, RATE_LIMIT_WRITE_MAX.
 *
 * Note: existing webhook routes (review/pr-webhook.ts, linear/github-webhook.ts)
 * have their own local createRateLimiter implementations with different shapes.
 * Not refactored here — out of scope. This file is for the new HTTP-API routes.
 */
import type { Request, Response, NextFunction } from 'express';

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

// Registry of every limiter's reset hook, so test setup can clear all
// in-memory state between tests without leaking limiter handles to callers.
const LIMITER_RESETS = new Set<() => void>();

/**
 * In-memory sliding-window rate limiter. Maps client IP → array of request
 * timestamps within the window. Returns whether the IP is currently over
 * the budget along with a Retry-After hint.
 */
export function createRateLimiter(maxRequests: number, windowMs: number) {
  const requestsByIp = new Map<string, number[]>();
  LIMITER_RESETS.add(() => requestsByIp.clear());
  return (clientIp: string): { limited: boolean; retryAfterSeconds?: number } => {
    const now = Date.now();
    const minTimestamp = now - windowMs;
    const active = (requestsByIp.get(clientIp) ?? []).filter((t) => t > minTimestamp);
    if (active.length >= maxRequests) {
      requestsByIp.set(clientIp, active);
      const oldest = active[0] ?? now;
      return {
        limited: true,
        retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
      };
    }
    active.push(now);
    requestsByIp.set(clientIp, active);
    return { limited: false };
  };
}

/**
 * Express middleware that applies a per-IP rate limit. Use as router-level
 * or per-route middleware:
 *
 *   router.post('/login', rateLimit(60, 60_000), validate({ body }), handler);
 *
 * Or apply at router level for all routes underneath:
 *
 *   router.use(rateLimit(300, 60_000));
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  const limiter = createRateLimiter(maxRequests, windowMs);
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = getClientIp(req);
    const result = limiter(clientIp);
    if (result.limited) {
      if (result.retryAfterSeconds !== undefined) {
        res.setHeader('Retry-After', String(result.retryAfterSeconds));
      }
      res.status(429).json({
        error: 'Too many requests',
        retryAfterSeconds: result.retryAfterSeconds,
      });
      return;
    }
    next();
  };
}

/**
 * Test-only: clear in-memory state for every limiter created via
 * createRateLimiter / rateLimit. Routes register limiters at module-load
 * time, so without this hook the singletons accumulate request history
 * across the entire test run and trip 429s mid-suite.
 */
export function __resetAllRateLimiters(): void {
  for (const reset of LIMITER_RESETS) reset();
}

/** Standard policy presets (sliding 1-minute window). */
export const ONE_MINUTE = 60_000;
export const AUTH_RATE_LIMIT = Number(process.env.RATE_LIMIT_AUTH_MAX) || 60;
export const READ_RATE_LIMIT = Number(process.env.RATE_LIMIT_READ_MAX) || 300;
export const WRITE_RATE_LIMIT = Number(process.env.RATE_LIMIT_WRITE_MAX) || 60;
