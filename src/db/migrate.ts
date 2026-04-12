/**
 * Database migrations - create tables
 */
import Database from 'better-sqlite3';
import { logger } from '../lib/logger.js';

/** Run migrations to create tables if they don't exist */
export function migrate(sqliteDb: Database.Database): void {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 0,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issue_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linear_issue_id TEXT NOT NULL,
      linear_identifier TEXT NOT NULL,
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      pr_number INTEGER NOT NULL,
      pr_url TEXT,
      source TEXT NOT NULL DEFAULT 'branch',
      confidence INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      last_sync_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (linear_issue_id, owner, repo, pr_number)
    );

    CREATE INDEX IF NOT EXISTS issue_mappings_linear_identifier_idx
      ON issue_mappings(linear_identifier);

    CREATE INDEX IF NOT EXISTS issue_mappings_repo_pr_idx
      ON issue_mappings(owner, repo, pr_number);

    CREATE INDEX IF NOT EXISTS issue_mappings_created_at_idx
      ON issue_mappings(created_at DESC);

    CREATE TABLE IF NOT EXISTS sync_events (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      correlation_key TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      event_type TEXT NOT NULL,
      linked_mapping_id INTEGER REFERENCES issue_mappings(id) ON DELETE SET NULL,
      error TEXT,
      processed_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dead_letter_events (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      error TEXT NOT NULL,
      source TEXT NOT NULL,
      event_type TEXT NOT NULL,
      processed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS security_scans (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL DEFAULT 'queued',
      prompt TEXT NOT NULL,
      context TEXT,
      options TEXT,
      risk_score INTEGER,
      severity TEXT,
      safe INTEGER,
      remediation_summary TEXT,
      error_message TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      queued_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scan_findings (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL REFERENCES security_scans(id) ON DELETE CASCADE,
      pattern TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      source TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  logger.info('Database migrations completed');
}
