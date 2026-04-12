/**
 * Database schema - Drizzle ORM
 */
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
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

// ─── Linear ↔ GitHub Issue Mappings ─────────────────────────────────────────

export const issueMappings = sqliteTable(
  'issue_mappings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    linearIssueId: text('linear_issue_id').notNull(),
    linearIdentifier: text('linear_identifier').notNull(),
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    prNumber: integer('pr_number').notNull(),
    prUrl: text('pr_url'),
    source: text('source', { enum: ['branch', 'title', 'commit', 'body', 'manual'] })
      .notNull()
      .default('branch'),
    confidence: integer('confidence').notNull().default(0),
    syncStatus: text('sync_status', { enum: ['pending', 'synced', 'failed'] })
      .notNull()
      .default('pending'),
    lastSyncAt: text('last_sync_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    linearIdentifierIdx: index('issue_mappings_linear_identifier_idx').on(table.linearIdentifier),
    repoPrIdx: index('issue_mappings_repo_pr_idx').on(table.owner, table.repo, table.prNumber),
    createdAtIdx: index('issue_mappings_created_at_idx').on(table.createdAt),
    uniqueLinearPr: uniqueIndex('issue_mappings_linear_pr_unique').on(
      table.linearIssueId,
      table.owner,
      table.repo,
      table.prNumber,
    ),
  }),
);

export type IssueMapping = typeof issueMappings.$inferSelect;
export type NewIssueMapping = typeof issueMappings.$inferInsert;

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


// ─── Linear ↔ GitHub Event Log ──────────────────────────────────────────────

export const syncEvents = sqliteTable('sync_events', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull(),
  payloadHash: text('payload_hash').notNull(),
  correlationKey: text('correlation_key').notNull(),
  action: text('action').notNull(),
  status: text('status', {
    enum: ['processed', 'retried', 'dead_lettered'],
  }).notNull(),
  source: text('source', { enum: ['github', 'linear'] }).notNull(),
  eventType: text('event_type').notNull(),
  linkedMappingId: integer('linked_mapping_id').references(() => issueMappings.id, {
    onDelete: 'set null',
  }),
  error: text('error'),
  processedAt: text('processed_at').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const deadLetterEvents = sqliteTable('dead_letter_events', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull(),
  payload: text('payload').notNull(),
  error: text('error').notNull(),
  source: text('source', { enum: ['github', 'linear'] }).notNull(),
  eventType: text('event_type').notNull(),
  processedAt: text('processed_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type SyncEvent = typeof syncEvents.$inferSelect;
export type NewSyncEvent = typeof syncEvents.$inferInsert;
export type DeadLetterEvent = typeof deadLetterEvents.$inferSelect;
export type NewDeadLetterEvent = typeof deadLetterEvents.$inferInsert;
