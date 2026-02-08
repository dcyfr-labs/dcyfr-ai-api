/**
 * Test helpers - shared test database and utilities
 */
import { createDb, type AppDb } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
import { users } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { generateToken } from '../src/services/auth-service.js';
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

/** Promote a user to admin role (for testing) */
export function promoteToAdmin(userId: number): void {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }
  testDb.update(users).set({ role: 'admin' }).where(eq(users.id, userId)).run();
}

/** Generate a JWT token with admin role (for testing) */
export function generateAdminToken(userId: number, email: string): string {
  return generateToken({ userId, email, role: 'admin' });
}
