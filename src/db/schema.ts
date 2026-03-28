/**
 * Database schema - Drizzle ORM
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['user', 'admin'] })
    .notNull()
    .default('user'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Table type exports for insert/select */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

// ─── Security Scans ──────────────────────────────────────────────────────────

/**
 * Tracks prompt security scan lifecycle: queued → running → complete | failed
 */
export const securityScans = sqliteTable('security_scans', {
  id: text('id').primaryKey(), // UUID
  state: text('state', { enum: ['queued', 'running', 'complete', 'failed'] })
    .notNull()
    .default('queued'),
  prompt: text('prompt').notNull(),
  context: text('context'),
  options: text('options'), // JSON blob for ScanOptions
  riskScore: integer('risk_score'),
  severity: text('severity', { enum: ['critical', 'high', 'medium', 'low', 'safe'] }),
  safe: integer('safe', { mode: 'boolean' }),
  remediationSummary: text('remediation_summary'),
  errorMessage: text('error_message'),
  attempts: integer('attempts').notNull().default(0),
  queuedAt: text('queued_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Individual findings (threats) discovered during a scan */
export const scanFindings = sqliteTable('scan_findings', {
  id: text('id').primaryKey(), // UUID
  scanId: text('scan_id')
    .notNull()
    .references(() => securityScans.id, { onDelete: 'cascade' }),
  pattern: text('pattern').notNull(),
  category: text('category').notNull(),
  severity: text('severity', { enum: ['critical', 'high', 'medium', 'low'] }).notNull(),
  confidence: integer('confidence').notNull(), // 0–100 integer (confidence * 100)
  source: text('source', { enum: ['iopc', 'taxonomy', 'pattern'] }).notNull(),
  details: text('details'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type SecurityScan = typeof securityScans.$inferSelect;
export type NewSecurityScan = typeof securityScans.$inferInsert;
export type ScanFinding = typeof scanFindings.$inferSelect;
export type NewScanFinding = typeof scanFindings.$inferInsert;
