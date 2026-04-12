import { beforeEach, describe, expect, it } from 'vitest';
import { MappingStore } from '../../src/services/mapping-store.js';
import { resetTestDb } from '../helpers.js';

let store: MappingStore;

beforeEach(() => {
  const db = resetTestDb();
  store = new MappingStore(db);
});

describe('MappingStore', () => {
  it('upserts a new mapping and fetches it by PR', async () => {
    const created = await store.upsert({
      linearIssueId: 'lin_123',
      linearIdentifier: 'DCYFR-123',
      owner: 'dcyfr',
      repo: 'dcyfr-ai',
      prNumber: 42,
      source: 'branch',
      confidence: 95,
    });

    expect(created.id).toBeGreaterThan(0);

    const byPr = await store.getByPr('dcyfr', 'dcyfr-ai', 42);
    expect(byPr).toBeDefined();
    expect(byPr?.linearIdentifier).toBe('DCYFR-123');
  });

  it('updates existing unique mapping on upsert', async () => {
    await store.upsert({
      linearIssueId: 'lin_456',
      linearIdentifier: 'DCYFR-456',
      owner: 'dcyfr',
      repo: 'dcyfr-ai-api',
      prNumber: 7,
      source: 'title',
      confidence: 80,
    });

    const updated = await store.upsert({
      linearIssueId: 'lin_456',
      linearIdentifier: 'DCYFR-456',
      owner: 'dcyfr',
      repo: 'dcyfr-ai-api',
      prNumber: 7,
      source: 'commit',
      confidence: 88,
      syncStatus: 'synced',
      prUrl: 'https://github.com/dcyfr/dcyfr-ai-api/pull/7',
    });

    expect(updated.source).toBe('commit');
    expect(updated.confidence).toBe(88);
    expect(updated.syncStatus).toBe('synced');
    expect(updated.prUrl).toContain('/pull/7');
  });

  it('gets mappings by linear key and updates sync status', async () => {
    const created = await store.upsert({
      linearIssueId: 'lin_789',
      linearIdentifier: 'DCYFR-789',
      owner: 'dcyfr',
      repo: 'dcyfr-labs',
      prNumber: 99,
      source: 'body',
      confidence: 70,
    });

    const byKey = await store.getByKey('DCYFR-789');
    expect(byKey).toHaveLength(1);

    const synced = await store.updateSyncStatus(created.id, 'synced');
    expect(synced.syncStatus).toBe('synced');
    expect(synced.lastSyncAt).toBeTruthy();
  });

  it('returns recent mappings newest first', async () => {
    await store.upsert({
      linearIssueId: 'lin_1',
      linearIdentifier: 'DCYFR-1',
      owner: 'dcyfr',
      repo: 'repo-one',
      prNumber: 1,
      source: 'branch',
      confidence: 90,
    });
    await store.upsert({
      linearIssueId: 'lin_2',
      linearIdentifier: 'DCYFR-2',
      owner: 'dcyfr',
      repo: 'repo-two',
      prNumber: 2,
      source: 'title',
      confidence: 91,
    });

    const recent = await store.getRecent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0]?.id).toBeGreaterThanOrEqual(recent[1]?.id ?? 0);
  });
});
