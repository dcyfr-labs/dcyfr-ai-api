import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createLinearGithubWebhookRouter } from '../../src/routes/linear/github-webhook.js';

function sign(payload: string, secret: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}

describe('Linear GitHub webhook route', () => {
  it('rejects invalid signatures', async () => {
    const app = express();
    app.use(
      express.json({
        verify: (req, _res, buf) => {
          (req as unknown as { rawBody: string }).rawBody = buf.toString();
        },
      }),
    );

    const mockService = {
      correlatePullRequest: vi.fn().mockResolvedValue({ matched: false, reason: 'no_identifier' }),
    };
    const mockSyncService = {
      syncPrOpened: vi.fn().mockResolvedValue(undefined),
    };

    app.use('/api/linear-sync', createLinearGithubWebhookRouter(mockService, mockSyncService, 'test-secret'));

    const payload = JSON.stringify({ action: 'opened' });

    const res = await request(app)
      .post('/api/linear-sync/github-webhook')
      .set('x-github-event', 'pull_request')
      .set('x-github-delivery', 'evt-001')
      .set('x-hub-signature-256', 'sha256=invalid')
      .set('content-type', 'application/json')
      .send(payload);

    expect(res.status).toBe(401);
    expect(mockService.correlatePullRequest).not.toHaveBeenCalled();
    expect(mockSyncService.syncPrOpened).not.toHaveBeenCalled();
  });

  it('accepts pull_request event and processes asynchronously', async () => {
    const app = express();
    app.use(
      express.json({
        verify: (req, _res, buf) => {
          (req as unknown as { rawBody: string }).rawBody = buf.toString();
        },
      }),
    );

    const mockService = {
      correlatePullRequest: vi.fn().mockResolvedValue({
        matched: true,
        linearIssueId: 'lin_111',
        identifier: 'DCYFR-111',
        source: 'branch',
        confidence: 0.95,
        mappingId: 1,
      }),
    };
    const mockSyncService = {
      syncPrOpened: vi.fn().mockResolvedValue(undefined),
    };

    app.use('/api/linear-sync', createLinearGithubWebhookRouter(mockService, mockSyncService, 'test-secret'));

    const payload = JSON.stringify({
      action: 'opened',
      pull_request: {
        number: 111,
        html_url: 'https://github.com/dcyfr/dcyfr-ai/pull/111',
        title: '[DCYFR-111] Implement sync',
        body: 'body',
        head: { ref: 'feature/DCYFR-111-implement-sync' },
      },
      repository: {
        name: 'dcyfr-ai',
        owner: { login: 'dcyfr' },
      },
    });

    const res = await request(app)
      .post('/api/linear-sync/github-webhook')
      .set('x-github-event', 'pull_request')
      .set('x-github-delivery', 'evt-002')
      .set('x-hub-signature-256', sign(payload, 'test-secret'))
      .set('content-type', 'application/json')
      .send(payload);

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockService.correlatePullRequest).toHaveBeenCalledTimes(1);
    expect(mockService.correlatePullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-002',
        owner: 'dcyfr',
        repo: 'dcyfr-ai',
        prNumber: 111,
      }),
    );
    expect(mockSyncService.syncPrOpened).toHaveBeenCalledTimes(1);
  });

  it('rate limits excessive requests from the same IP', async () => {
    const app = express();
    app.use(
      express.json({
        verify: (req, _res, buf) => {
          (req as unknown as { rawBody: string }).rawBody = buf.toString();
        },
      }),
    );

    const mockService = {
      correlatePullRequest: vi.fn().mockResolvedValue({ matched: false, reason: 'no_identifier' }),
    };
    const mockSyncService = {
      syncPrOpened: vi.fn().mockResolvedValue(undefined),
    };

    app.use(
      '/api/linear-sync',
      createLinearGithubWebhookRouter(
        mockService,
        mockSyncService,
        'test-secret',
        { maxRequests: 2, windowMs: 60_000, now: () => 1_700_000_000_000 },
      ),
    );

    const payload = JSON.stringify({
      action: 'opened',
      pull_request: {
        number: 777,
        html_url: 'https://github.com/dcyfr/dcyfr-ai/pull/777',
        title: '[DCYFR-777] test',
        body: 'body',
        head: { ref: 'feature/DCYFR-777-test' },
      },
      repository: {
        name: 'dcyfr-ai',
        owner: { login: 'dcyfr' },
      },
    });

    const sendWebhook = () => request(app)
      .post('/api/linear-sync/github-webhook')
      .set('x-forwarded-for', '203.0.113.10')
      .set('x-github-event', 'pull_request')
      .set('x-hub-signature-256', sign(payload, 'test-secret'))
      .set('content-type', 'application/json')
      .send(payload);

    const first = await sendWebhook();
    const second = await sendWebhook();
    const third = await sendWebhook();

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(third.status).toBe(429);
    expect(third.body.error).toBe('Too many requests');
    expect(third.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(third.headers['retry-after']).toBeDefined();
  });

  it('handles non-json ping requests without crashing', async () => {
    const app = express();
    app.use(
      express.json({
        verify: (req, _res, buf) => {
          (req as unknown as { rawBody: string }).rawBody = buf.toString();
        },
      }),
    );

    const mockService = {
      correlatePullRequest: vi.fn().mockResolvedValue({ matched: false, reason: 'no_identifier' }),
    };
    const mockSyncService = {
      syncPrOpened: vi.fn().mockResolvedValue(undefined),
    };

    app.use('/api/linear-sync', createLinearGithubWebhookRouter(mockService, mockSyncService, 'test-secret'));

    const payload = '';

    const res = await request(app)
      .post('/api/linear-sync/github-webhook')
      .set('x-github-event', 'ping')
      .set('x-github-delivery', 'evt-ping')
      .set('x-hub-signature-256', sign(payload, 'test-secret'))
      .set('content-type', 'text/plain')
      .send(payload);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ accepted: true, skipped: true, reason: 'unsupported_event_type' });
    expect(mockService.correlatePullRequest).not.toHaveBeenCalled();
    expect(mockSyncService.syncPrOpened).not.toHaveBeenCalled();
  });
});
