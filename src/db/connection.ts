/**
 * Database connection
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Ensure the data directory exists */
function ensureDataDir(dbPath: string): void {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
}

export interface DbInstance {
  orm: ReturnType<typeof drizzle<typeof schema>>;
  sqlite: Database.Database;
}

/** Create and return a database instance */
export function createDb(url?: string): DbInstance {
  const dbUrl = url || config.db.url;
  ensureDataDir(dbUrl);

  const sqlite = new Database(dbUrl);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  logger.info({ url: dbUrl }, 'Database connected');

  return {
    orm: drizzle(sqlite, { schema }),
    sqlite,
  };
}

export type AppDb = ReturnType<typeof drizzle<typeof schema>>;

/** Default database instance */
const defaultInstance = createDb();
export const db: AppDb = defaultInstance.orm;
export const sqliteDb: Database.Database = defaultInstance.sqlite;
