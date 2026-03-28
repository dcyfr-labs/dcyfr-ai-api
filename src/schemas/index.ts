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

// ─── Security Scans ──────────────────────────────────

/** Valid scan states following the deterministic state model */
export const scanStateSchema = z.enum(['queued', 'running', 'complete', 'failed']);
export type ScanState = z.infer<typeof scanStateSchema>;

/** Request body for submitting a new prompt security scan */
export const submitScanSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(10_000, 'Prompt must be 10,000 characters or fewer'),
  context: z.string().max(5_000, 'Context must be 5,000 characters or fewer').optional(),
  options: z.object({
    maxRiskScore: z.number().int().min(0).max(100).optional(),
    checkPatterns: z.boolean().optional(),
    checkIoPC: z.boolean().optional(),
  }).optional(),
});
export type SubmitScanInput = z.infer<typeof submitScanSchema>;

/** URL param for looking up a specific scan */
export const scanIdParamSchema = z.object({
  id: z.string().uuid('Scan ID must be a valid UUID'),
});

/** Threat match shape returned in scan results */
export const threatMatchSchema = z.object({
  pattern: z.string(),
  category: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  confidence: z.number(),
  source: z.enum(['iopc', 'taxonomy', 'pattern']),
  details: z.string().optional(),
});
export type ThreatMatch = z.infer<typeof threatMatchSchema>;

/** Finding as persisted and returned in API responses */
export const findingSchema = z.object({
  id: z.string().uuid(),
  scanId: z.string().uuid(),
  pattern: z.string(),
  category: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  confidence: z.number(),
  source: z.enum(['iopc', 'taxonomy', 'pattern']),
  details: z.string().nullable(),
});
export type Finding = z.infer<typeof findingSchema>;
