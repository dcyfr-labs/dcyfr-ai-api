import { describe, expect, it, vi, afterEach } from 'vitest';
import { LinearGraphqlWriteClient, LinearSyncService, type LinearWriteClient } from '../../src/services/linear-sync-service.js';

// ─── LinearGraphqlWriteClient.addLabel ───────────────────────────────────────

describe('LinearGraphqlWriteClient.addLabel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(responses: Array<{ data: unknown }>) {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const body = responses[call++] ?? { data: {} };
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(body),
      });
    }));
  }

  it('skips addLabel call when issue already has the label', async () => {
    mockFetch([{
      data: {
        issue: {
          labels: { nodes: [{ id: 'lbl_1', name: 'GitHub PR' }] },
          team: { id: 'team_1', labels: { nodes: [{ id: 'lbl_1', name: 'GitHub PR' }] } },
        },
      },
    }]);

    const client = new LinearGraphqlWriteClient('test-key');
    await client.addLabel('issue_1', 'GitHub PR');

    const fetchMock = vi.mocked(fetch);
    // Only one call — the team/label query. No issueAddLabel call.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses issueAddLabel when team label exists', async () => {
    mockFetch([
      // query: issue has no label yet, team has the label
      { data: { issue: { labels: { nodes: [] }, team: { id: 'team_1', labels: { nodes: [{ id: 'lbl_existing', name: 'GitHub PR' }] } } } } },
      // issueAddLabel mutation
      { data: { issueAddLabel: { success: true } } },
    ]);

    const client = new LinearGraphqlWriteClient('test-key');
    await client.addLabel('issue_1', 'GitHub PR');

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const addCall = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string) as { variables: { labelId: string } };
    expect(addCall.variables.labelId).toBe('lbl_existing');
  });

  it('creates the label when not found on team, then calls issueAddLabel', async () => {
    mockFetch([
      // query: no current label, team has no "GitHub PR" label
      { data: { issue: { labels: { nodes: [] }, team: { id: 'team_42', labels: { nodes: [] } } } } },
      // issueLabelCreate
      { data: { issueLabelCreate: { issueLabel: { id: 'lbl_new' } } } },
      // issueAddLabel
      { data: { issueAddLabel: { success: true } } },
    ]);

    const client = new LinearGraphqlWriteClient('test-key');
    await client.addLabel('issue_1', 'GitHub PR');

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const createCall = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string) as { variables: { input: { name: string; teamId: string } } };
    expect(createCall.variables.input.name).toBe('GitHub PR');
    expect(createCall.variables.input.teamId).toBe('team_42');

    const addCall = JSON.parse(fetchMock.mock.calls[2]![1]!.body as string) as { variables: { labelId: string } };
    expect(addCall.variables.labelId).toBe('lbl_new');
  });
});

// ─── LinearSyncService ───────────────────────────────────────────────────────

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
