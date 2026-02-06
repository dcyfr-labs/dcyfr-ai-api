/**
 * Tests for error classes
 */
import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '../../src/lib/errors.js';

describe('AppError', () => {
  it('should create with status code and message', () => {
    const err = new AppError(500, 'Something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('Something went wrong');
    expect(err.name).toBe('AppError');
  });

  it('should include optional code and details', () => {
    const err = new AppError(400, 'Bad request', 'BAD_REQUEST', { field: 'email' });
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.details).toEqual({ field: 'email' });
  });
});

describe('NotFoundError', () => {
  it('should have 404 status', () => {
    const err = new NotFoundError('User');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('User not found');
    expect(err.code).toBe('NOT_FOUND');
  });

  it('should include resource id in message', () => {
    const err = new NotFoundError('User', 42);
    expect(err.message).toBe("User with id '42' not found");
  });
});

describe('ValidationError', () => {
  it('should have 400 status', () => {
    const err = new ValidationError('Invalid email');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('should include details', () => {
    const err = new ValidationError('Validation failed', [{ field: 'email' }]);
    expect(err.details).toEqual([{ field: 'email' }]);
  });
});

describe('UnauthorizedError', () => {
  it('should have 401 status', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Authentication required');
  });

  it('should accept custom message', () => {
    const err = new UnauthorizedError('Invalid token');
    expect(err.message).toBe('Invalid token');
  });
});

describe('ForbiddenError', () => {
  it('should have 403 status', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});

describe('ConflictError', () => {
  it('should have 409 status', () => {
    const err = new ConflictError('Email already exists');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Email already exists');
  });
});
