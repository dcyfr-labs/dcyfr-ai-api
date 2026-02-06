/**
 * Tests for auth middleware
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuth, authorize, apiKeyAuth } from '../../src/middleware/auth.js';
import { generateToken } from '../../src/services/auth-service.js';

function createMockReq(headers: Record<string, string> = {}): Request {
  return { headers, user: undefined } as unknown as Request;
}

const mockRes = {} as Response;
const mockNext = vi.fn() as NextFunction;

describe('authenticate', () => {
  it('should set req.user for valid token', () => {
    const token = generateToken({ userId: 1, email: 'test@test.com', role: 'user' });
    const req = createMockReq({ authorization: `Bearer ${token}` });

    authenticate(req, mockRes, mockNext);
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe(1);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should throw for missing token', () => {
    const req = createMockReq();
    expect(() => authenticate(req, mockRes, mockNext)).toThrow('Missing authentication token');
  });

  it('should throw for invalid token', () => {
    const req = createMockReq({ authorization: 'Bearer invalid-token' });
    expect(() => authenticate(req, mockRes, mockNext)).toThrow('Invalid or expired token');
  });
});

describe('optionalAuth', () => {
  it('should set req.user for valid token', () => {
    const token = generateToken({ userId: 2, email: 'opt@test.com', role: 'user' });
    const req = createMockReq({ authorization: `Bearer ${token}` });

    optionalAuth(req, mockRes, mockNext);
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe(2);
  });

  it('should not throw for missing token', () => {
    const req = createMockReq();
    optionalAuth(req, mockRes, mockNext);
    expect(req.user).toBeUndefined();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should not throw for invalid token', () => {
    const req = createMockReq({ authorization: 'Bearer bad-token' });
    optionalAuth(req, mockRes, mockNext);
    expect(req.user).toBeUndefined();
  });
});

describe('authorize', () => {
  it('should pass for matching role', () => {
    const req = createMockReq();
    req.user = { userId: 1, email: 'a@test.com', role: 'admin' };

    authorize('admin')(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should throw for non-matching role', () => {
    const req = createMockReq();
    req.user = { userId: 1, email: 'a@test.com', role: 'user' };

    expect(() => authorize('admin')(req, mockRes, mockNext)).toThrow('Insufficient permissions');
  });

  it('should throw when no user', () => {
    const req = createMockReq();
    expect(() => authorize('admin')(req, mockRes, mockNext)).toThrow('Authentication required');
  });
});

describe('apiKeyAuth', () => {
  it('should throw for missing API key', () => {
    const req = createMockReq();
    expect(() => apiKeyAuth(req, mockRes, mockNext)).toThrow('Invalid or missing API key');
  });

  it('should throw for invalid API key', () => {
    const req = createMockReq({ 'x-api-key': 'wrong-key' });
    expect(() => apiKeyAuth(req, mockRes, mockNext)).toThrow('Invalid or missing API key');
  });
});
