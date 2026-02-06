/**
 * Test setup
 */
import { afterAll } from 'vitest';
import { rmSync, existsSync } from 'node:fs';

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
