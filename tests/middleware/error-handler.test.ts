/**
 * Tests for error handler middleware
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssueCode } from 'zod';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { AppError, NotFoundError, ValidationError } from '../../src/lib/errors.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
  } as unknown as Response;
  return res;
}

const mockReq = {} as Request;
const mockNext = vi.fn() as NextFunction;

describe('errorHandler', () => {
  it('should handle AppError', () => {
    const err = new AppError(400, 'Bad request', 'BAD_REQUEST');
    const res = createMockRes();
    errorHandler(err, mockReq, res, mockNext);

    expect(res.statusCode).toBe(400);
    expect((res as unknown as { body: { error: { code: string } } }).body.error.code).toBe(
      'BAD_REQUEST',
    );
  });

  it('should handle NotFoundError', () => {
    const err = new NotFoundError('User', 42);
    const res = createMockRes();
    errorHandler(err, mockReq, res, mockNext);

    expect(res.statusCode).toBe(404);
  });

  it('should handle ValidationError', () => {
    const err = new ValidationError('Invalid input');
    const res = createMockRes();
    errorHandler(err, mockReq, res, mockNext);

    expect(res.statusCode).toBe(400);
  });

  it('should handle ZodError', () => {
    const zodErr = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'number',
        path: ['email'],
        message: 'Expected string, received number',
      },
    ]);
    const res = createMockRes();
    errorHandler(zodErr, mockReq, res, mockNext);

    expect(res.statusCode).toBe(400);
    const body = (res as unknown as { body: { error: { code: string; details: unknown[] } } }).body;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toHaveLength(1);
  });

  it('should handle unknown errors as 500', () => {
    const err = new Error('Something unexpected');
    const res = createMockRes();
    errorHandler(err, mockReq, res, mockNext);

    expect(res.statusCode).toBe(500);
    const body = (res as unknown as { body: { error: { code: string } } }).body;
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
