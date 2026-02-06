/**
 * Test helpers - shared test database and utilities
 */
import { createDb, type AppDb } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
import type { Express } from 'express';

let testDb: AppDb | undefined;

/** Get or create a test database (in-memory) */
export function getTestDb(): AppDb {
  if (!testDb) {
    const { orm, sqlite } = createDb(':memory:');
    migrate(sqlite);
    testDb = orm;
  }
  return testDb;
}

/** Create a test Express app */
export function createTestApp(): Express {
  return createApp();
}

/** Reset the test database by re-creating it */
export function resetTestDb(): AppDb {
  const { orm, sqlite } = createDb(':memory:');
  migrate(sqlite);
  testDb = orm;
  return testDb;
}
