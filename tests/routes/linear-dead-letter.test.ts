import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createLinearGithubWebhookRouter } from '../../src/routes/linear/github-webhook.js';

describe('Linear dead-letter routes', () => {
  it('lists pending dead-letter events', async () => {
    const app = express();
    app.use(express.json());

    const deadLetterService = {
      record: vi.fn(),
      getPending: vi.fn().mockResolvedValue([
        {
          id: 'dead-1',
          eventId: 'evt-500',
          payload: '{"action":"opened"}',
          error: 'linear unavailable',
          source: 'github',
          eventType: 'pull_request',
          processedAt: null,
          createdAt: '2026-04-12T00:00:00.000Z',
        },
      ]),
      getByEventId: vi.fn(),
      markProcessed: vi.fn(),
    };

    app.use(
      '/api/linear-sync',
      createLinearGithubWebhookRouter(
        { correlatePullRequest: vi.fn() },
        { syncPrOpened: vi.fn() },
        'test-secret',
        { maxRequests: 5, windowMs: 60_000 },
        deadLetterService,
      ),
    );

    const res = await request(app).get('/api/linear-sync/dead-letter');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      eventId: 'evt-500',
      error: 'linear unavailable',
      source: 'github',
    });
  });

  it('replays a stored pull_request dead-letter event', async () => {
    const app = express();
    app.use(express.json());

    const correlatePullRequest = vi.fn().mockResolvedValue({
      matched: true,
      linearIssueId: 'lin_789',
      identifier: 'DCYFR-789',
      source: 'branch',
      confidence: 0.95,
      mappingId: 9,
    });
    const syncPrOpened = vi.fn().mockResolvedValue(undefined);
    const deadLetterService = {
      record: vi.fn(),
      getPending: vi.fn().mockResolvedValue([]),
      getByEventId: vi.fn().mockResolvedValue({
        id: 'dead-2',
        eventId: 'evt-789',
        payload: JSON.stringify({
          action: 'opened',
          pull_request: {
            number: 789,
            html_url: 'https://github.com/dcyfr/dcyfr-ai/pull/789',
            title: '[DCYFR-789] Replay me',
            body: 'body',
            head: { ref: 'feature/DCYFR-789-replay-me' },
          },
          repository: {
            name: 'dcyfr-ai',
            owner: { login: 'dcyfr' },
          },
        }),
        error: 'temporary failure',
        source: 'github',
        eventType: 'pull_request',
        processedAt: null,
        createdAt: '2026-04-12T00:00:00.000Z',
      }),
      markProcessed: vi.fn().mockResolvedValue({
        id: 'dead-2',
        eventId: 'evt-789',
        processedAt: '2026-04-12T00:01:00.000Z',
      }),
    };

    app.use(
      '/api/linear-sync',
      createLinearGithubWebhookRouter(
        { correlatePullRequest },
        { syncPrOpened },
        'test-secret',
        { maxRequests: 5, windowMs: 60_000 },
        deadLetterService,
      ),
    );

    const res = await request(app).post('/api/linear-sync/replay/evt-789');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ replayed: true, eventId: 'evt-789' });
    expect(correlatePullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-789',
        owner: 'dcyfr',
        repo: 'dcyfr-ai',
        prNumber: 789,
      }),
    );
    expect(syncPrOpened).toHaveBeenCalledTimes(1);
    expect(deadLetterService.markProcessed).toHaveBeenCalledWith('evt-789');
  });

  it('rejects replay when the stored payload is invalid JSON', async () => {
    const app = express();
    app.use(express.json());

    const deadLetterService = {
      record: vi.fn(),
      getPending: vi.fn().mockResolvedValue([]),
      getByEventId: vi.fn().mockResolvedValue({
        id: 'dead-3',
        eventId: 'evt-bad-json',
        payload: '{not-json',
        error: 'bad payload',
        source: 'github',
        eventType: 'pull_request',
        processedAt: null,
        createdAt: '2026-04-12T00:00:00.000Z',
      }),
      markProcessed: vi.fn(),
    };

    app.use(
      '/api/linear-sync',
      createLinearGithubWebhookRouter(
        { correlatePullRequest: vi.fn() },
        { syncPrOpened: vi.fn() },
        'test-secret',
        { maxRequests: 5, windowMs: 60_000 },
        deadLetterService,
      ),
    );

    const res = await request(app).post('/api/linear-sync/replay/evt-bad-json');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dead-letter payload is not valid JSON');
    expect(deadLetterService.markProcessed).not.toHaveBeenCalled();
  });
});
