/**
 * Zod validation schemas for API requests
 */
import { z } from 'zod';

// ─── Auth ────────────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Users ───────────────────────────────────────────
export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['user', 'admin']).optional(),
});

export const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// ─── Posts ───────────────────────────────────────────
export const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
  published: z.boolean().optional().default(false),
});

export const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  published: z.boolean().optional(),
});

export const postIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// ─── Query ───────────────────────────────────────────
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
