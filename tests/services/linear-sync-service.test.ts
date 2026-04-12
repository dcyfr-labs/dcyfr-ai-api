import { describe, expect, it, vi } from 'vitest';
import { LinearSyncService, type LinearWriteClient } from '../../src/services/linear-sync-service.js';

describe('LinearSyncService', () => {
  it('logs dry-run without executing writes', async () => {
    const client: LinearWriteClient = {
      addComment: vi.fn().mockResolvedValue(undefined),
      addLabel: vi.fn().mockResolvedValue(undefined),
    };

    const service = new LinearSyncService(client, true);

    await service.syncPrOpened({
      eventId: 'evt-dry',
      issueId: 'lin_123',
      issueIdentifier: 'DCYFR-123',
      owner: 'dcyfr',
      repo: 'dcyfr-ai',
      prNumber: 123,
      prUrl: 'https://github.com/dcyfr/dcyfr-ai/pull/123',
    });

    expect(client.addComment).not.toHaveBeenCalled();
    expect(client.addLabel).not.toHaveBeenCalled();
  });

  it('executes read-only write actions when dry-run disabled', async () => {
    const client: LinearWriteClient = {
      addComment: vi.fn().mockResolvedValue(undefined),
      addLabel: vi.fn().mockResolvedValue(undefined),
    };

    const service = new LinearSyncService(client, false);

    await service.syncPrOpened({
      eventId: 'evt-sync',
      issueId: 'lin_456',
      issueIdentifier: 'DCYFR-456',
      owner: 'dcyfr',
      repo: 'dcyfr-ai-api',
      prNumber: 456,
      prUrl: 'https://github.com/dcyfr/dcyfr-ai-api/pull/456',
    });

    expect(client.addComment).toHaveBeenCalledTimes(1);
    expect(client.addComment).toHaveBeenCalledWith(
      'lin_456',
      expect.stringContaining('PR #456 opened:'),
    );
    expect(client.addLabel).toHaveBeenCalledTimes(1);
    expect(client.addLabel).toHaveBeenCalledWith('lin_456', 'GitHub PR');
  });
});
