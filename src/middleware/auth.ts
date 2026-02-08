/**
 * Authentication middleware - JWT and API key
 */
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Extract Bearer token from Authorization header */
function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return undefined;
}

/** JWT authentication middleware */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    throw new UnauthorizedError('Missing authentication token');
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/** Optional JWT - sets req.user if token present, doesn't fail otherwise */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      req.user = payload;
    } catch {
      // Ignore invalid tokens for optional auth
    }
  }
  next();
}

/** Role-based authorization */
export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
    next();
  };
}

/** API key authentication */
export function apiKeyAuth(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey || !config.apiKeys.includes(apiKey)) {
    throw new UnauthorizedError('Invalid or missing API key');
  }
  next();
}
