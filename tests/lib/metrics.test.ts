import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLinearGithubWebhookRouter } from '../../src/routes/linear/github-webhook.js';
import { funnelWebhookRequests, registry as metricsRegistry } from '../../src/lib/metrics.js';

function sign(payload: string, secret: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}

function buildApp() {
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
      linearIssueId: 'lin_abc',
      identifier: 'DCYFR-42',
      source: 'branch',
      confidence: 0.95,
      mappingId: 1,
    }),
  };
  const mockSyncService = { syncPrOpened: vi.fn().mockResolvedValue(undefined) };

  app.use(
    '/api/linear-sync',
    createLinearGithubWebhookRouter(mockService, mockSyncService, 'test-secret'),
  );
  return app;
}

/**
 * prom-client counters are module-level singletons, so every test in this
 * file shares the same series. Reset before each case so we can assert on
 * absolute counts without per-test coupling.
 */
async function currentCount(labels: Record<string, string>): Promise<number> {
  const metric = await funnelWebhookRequests.get();
  for (const v of metric.values) {
    let match = true;
    for (const k of Object.keys(labels)) {
      if (v.labels[k] !== labels[k]) { match = false; break; }
    }
    if (match) return v.value;
  }
  return 0;
}

describe('funnelWebhookRequests counter', () => {
  beforeEach(() => {
    funnelWebhookRequests.reset();
  });

  it('increments result=accepted on a fully-valid pull_request event', async () => {
    const app = buildApp();
    const payload = JSON.stringify({
      action: 'opened',
      pull_request: {
        number: 42,
        html_url: 'https://github.com/dcyfr/dcyfr-ai-api/pull/42',
        title: '[DCYFR-42] test',
        body: 'body',
        head: { ref: 'feature/DCYFR-42' },
      },
      repository: { name: 'dcyfr-ai-api', owner: { login: 'dcyfr' } },
      sender: { login: 'drew' },
    });

    const res = await request(app)
      .post('/api/linear-sync/github-webhook')
      .set('x-github-event', 'pull_request')
      .set('x-github-delivery', 'evt-001')
      .set('x-hub-signature-256', sign(payload, 'test-secret'))
      .set('content-type', 'application/json')
      .send(payload);

    expect(res.status).toBe(202);
    expect(
      await currentCount({ route: 'linear_github_webhook', result: 'accepted' }),
    ).toBe(1);
  });

  it('increments result=invalid_signature on HMAC mismatch', async () => {
    const app = buildApp();
    const payload = JSON.stringify({ action: 'opened' });

    await request(app)
      .post('/api/linear-sync/github-webhook')
      .set('x-github-event', 'pull_request')
      .set('x-github-delivery', 'evt-002')
      .set('x-hub-signature-256', 'sha256=deadbeef')
      .set('content-type', 'application/json')
      .send(payload);

    expect(
      await currentCount({ route: 'linear_github_webhook', result: 'invalid_signature' }),
    ).toBe(1);
  });

  it('increments result=unsupported_event when x-github-event is not pull_request', async () => {
    const app = buildApp();
    const payload = JSON.stringify({ zen: 'ping' });

    await request(app)
      .post('/api/linear-sync/github-webhook')
      .set('x-github-event', 'ping')
      .set('x-github-delivery', 'evt-003')
      .set('x-hub-signature-256', sign(payload, 'test-secret'))
      .set('content-type', 'application/json')
      .send(payload);

    expect(
      await currentCount({ route: 'linear_github_webhook', result: 'unsupported_event' }),
    ).toBe(1);
  });

  it('increments result=missing_metadata when payload lacks pull_request number', async () => {
    const app = buildApp();
    const payload = JSON.stringify({ action: 'opened', pull_request: {} });

    await request(app)
      .post('/api/linear-sync/github-webhook')
      .set('x-github-event', 'pull_request')
      .set('x-github-delivery', 'evt-004')
      .set('x-hub-signature-256', sign(payload, 'test-secret'))
      .set('content-type', 'application/json')
      .send(payload);

    expect(
      await currentCount({ route: 'linear_github_webhook', result: 'missing_metadata' }),
    ).toBe(1);
  });

  it('increments result=unsupported_action for actions other than opened/synchronize', async () => {
    const app = buildApp();
    const payload = JSON.stringify({
      action: 'closed',
      pull_request: { number: 42, html_url: 'x', title: 'y', body: 'z', head: { ref: 'main' } },
      repository: { name: 'r', owner: { login: 'o' } },
    });

    await request(app)
      .post('/api/linear-sync/github-webhook')
      .set('x-github-event', 'pull_request')
      .set('x-github-delivery', 'evt-005')
      .set('x-hub-signature-256', sign(payload, 'test-secret'))
      .set('content-type', 'application/json')
      .send(payload);

    expect(
      await currentCount({ route: 'linear_github_webhook', result: 'unsupported_action' }),
    ).toBe(1);
  });

  it('increments result=missing_secret when webhookSecret is empty', async () => {
    const app = express();
    app.use(
      express.json({
        verify: (req, _res, buf) => {
          (req as unknown as { rawBody: string }).rawBody = buf.toString();
        },
      }),
    );
    const mockService = { correlatePullRequest: vi.fn() };
    const mockSyncService = { syncPrOpened: vi.fn() };
    // Passing '' (not undefined) because the route's default arg resolves
    // `undefined` to process.env.GITHUB_WEBHOOK_SECRET, which may be set
    // in the test environment. Explicit falsy value trips the missing-
    // secret branch unambiguously.
    app.use(
      '/api/linear-sync',
      createLinearGithubWebhookRouter(mockService, mockSyncService, ''),
    );

    await request(app)
      .post('/api/linear-sync/github-webhook')
      .set('x-github-event', 'pull_request')
      .send({});

    expect(
      await currentCount({ route: 'linear_github_webhook', result: 'missing_secret' }),
    ).toBe(1);
  });

  it('increments result=rate_limited when IP exceeds window', async () => {
    const app = express();
    app.use(
      express.json({
        verify: (req, _res, buf) => {
          (req as unknown as { rawBody: string }).rawBody = buf.toString();
        },
      }),
    );
    const mockService = { correlatePullRequest: vi.fn() };
    const mockSyncService = { syncPrOpened: vi.fn() };

    // maxRequests=1 → second request from same IP gets limited.
    app.use(
      '/api/linear-sync',
      createLinearGithubWebhookRouter(mockService, mockSyncService, 'test-secret', {
        maxRequests: 1,
        windowMs: 60_000,
      }),
    );

    const payload = JSON.stringify({ action: 'opened' });
    const headers = {
      'x-github-event': 'pull_request',
      'x-github-delivery': 'evt-006',
      'x-hub-signature-256': sign(payload, 'test-secret'),
      'content-type': 'application/json',
    };

    await request(app).post('/api/linear-sync/github-webhook').set(headers).send(payload);
    await request(app).post('/api/linear-sync/github-webhook').set(headers).send(payload);

    expect(
      await currentCount({ route: 'linear_github_webhook', result: 'rate_limited' }),
    ).toBe(1);
  });
});

describe('metrics registry exposure', () => {
  it('registers funnel_webhook_requests_total with labels', async () => {
    funnelWebhookRequests.reset();
    funnelWebhookRequests.inc({ route: 'linear_github_webhook', result: 'accepted' });

    const exposed = await metricsRegistry.metrics();
    expect(exposed).toContain(
      'funnel_webhook_requests_total{route="linear_github_webhook",result="accepted"} 1',
    );
    // HELP + TYPE lines present
    expect(exposed).toMatch(/# HELP funnel_webhook_requests_total/);
    expect(exposed).toMatch(/# TYPE funnel_webhook_requests_total counter/);
  });

  it('uses text/plain content-type suitable for Prometheus scrape', () => {
    // prom-client exposes the canonical content-type on the registry
    expect(metricsRegistry.contentType).toMatch(/text\/plain/);
    expect(metricsRegistry.contentType).toMatch(/version=0\.0\.4/);
  });
});
