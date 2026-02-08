/**
 * Test setup - Ensures database is properly initialized for integration tests
 */
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { rmSync, existsSync } from 'node:fs';
import { sqliteDb } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';

// Run migrations before all tests
beforeAll(() => {
  migrate(sqliteDb);
});

// Clean database before each test
beforeEach(() => {
  // Clear all tables
  const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>;
  
  tables.forEach((table) => {
    sqliteDb.prepare(`DELETE FROM ${table.name}`).run();
  });
});

// Clean up test databases after all tests
afterAll(() => {
  const testDbPath = './data/test.db';
  if (existsSync(testDbPath)) {
    rmSync(testDbPath, { force: true });
  }
  // Clean WAL/SHM files too
  if (existsSync(`${testDbPath}-wal`)) rmSync(`${testDbPath}-wal`, { force: true });
  if (existsSync(`${testDbPath}-shm`)) rmSync(`${testDbPath}-shm`, { force: true });
});
