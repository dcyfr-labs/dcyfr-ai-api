/**
 * Tests for validate middleware
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../src/middleware/validate.js';

describe('validate middleware', () => {
  const mockRes = {} as Response;
  const mockNext = vi.fn() as NextFunction;

  it('should validate and parse body', () => {
    const schema = z.object({ name: z.string() });
    const req = { body: { name: 'Test' }, query: {}, params: {} } as unknown as Request;

    validate({ body: schema })(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(req.body.name).toBe('Test');
  });

  it('should throw on invalid body', () => {
    const schema = z.object({ name: z.string() });
    const req = { body: { name: 123 }, query: {}, params: {} } as unknown as Request;

    expect(() => validate({ body: schema })(req, mockRes, mockNext)).toThrow();
  });

  it('should validate query params', () => {
    const schema = z.object({ page: z.coerce.number() });
    const req = { body: {}, query: { page: '3' }, params: {} } as unknown as Request;

    validate({ query: schema })(req, mockRes, mockNext);
    expect(req.query.page).toBe(3);
  });

  it('should validate path params', () => {
    const schema = z.object({ id: z.coerce.number() });
    const req = { body: {}, query: {}, params: { id: '42' } } as unknown as Request;

    validate({ params: schema })(req, mockRes, mockNext);
    expect(req.params.id).toBe(42);
  });

  it('should pass through when no schemas given', () => {
    const req = { body: {}, query: {}, params: {} } as unknown as Request;
    validate({})(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
});
