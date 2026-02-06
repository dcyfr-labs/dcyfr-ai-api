/**
 * Tests for validation schemas
 */
import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  updateUserSchema,
  userIdParamSchema,
  createPostSchema,
  updatePostSchema,
  postIdParamSchema,
  paginationSchema,
} from '../../src/schemas/index.js';

describe('registerSchema', () => {
  it('should accept valid registration data', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      name: 'Test User',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      name: 'Test',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject short password', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      name: 'Test',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      name: '',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('should accept valid login data', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('should accept partial updates', () => {
    const result = updateUserSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('should accept role update', () => {
    const result = updateUserSchema.safeParse({ role: 'admin' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid role', () => {
    const result = updateUserSchema.safeParse({ role: 'superadmin' });
    expect(result.success).toBe(false);
  });

  it('should accept empty object', () => {
    const result = updateUserSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('userIdParamSchema', () => {
  it('should coerce string to number', () => {
    const result = userIdParamSchema.safeParse({ id: '42' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe(42);
  });

  it('should reject negative id', () => {
    const result = userIdParamSchema.safeParse({ id: '-1' });
    expect(result.success).toBe(false);
  });
});

describe('createPostSchema', () => {
  it('should accept valid post data', () => {
    const result = createPostSchema.safeParse({
      title: 'My Post',
      content: 'Hello world',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.published).toBe(false);
  });

  it('should accept published flag', () => {
    const result = createPostSchema.safeParse({
      title: 'My Post',
      content: 'Hello world',
      published: true,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.published).toBe(true);
  });

  it('should reject empty title', () => {
    const result = createPostSchema.safeParse({
      title: '',
      content: 'Hello world',
    });
    expect(result.success).toBe(false);
  });
});

describe('updatePostSchema', () => {
  it('should accept partial updates', () => {
    const result = updatePostSchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = updatePostSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('postIdParamSchema', () => {
  it('should coerce string to number', () => {
    const result = postIdParamSchema.safeParse({ id: '1' });
    expect(result.success).toBe(true);
  });
});

describe('paginationSchema', () => {
  it('should use defaults', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('should reject limit > 100', () => {
    const result = paginationSchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });
});
