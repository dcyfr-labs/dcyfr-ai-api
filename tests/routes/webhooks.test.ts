/**
 * Tests for /webhooks route — Inngest → APNS push notification dispatcher.
 *
 * Covers:
 *   - 500 when INNGEST_WEBHOOK_SECRET is missing
 *   - 401 when the X-Inngest-Signature header is missing
 *   - 401 when the signature has the wrong prefix
 *   - 401 on signature mismatch
 *   - 400 when required payload fields are missing
 *   - 200 + dispatch on a valid HMAC-signed request
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';

const SECRET = 'test-inngest-secret';

function sign(body: string, secret = SECRET): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('POST /webhooks/approval-notification', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.INNGEST_WEBHOOK_SECRET = SECRET;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns 500 when INNGEST_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.INNGEST_WEBHOOK_SECRET;
    const app = createApp();
    const body = { agentId: 'a1', approvalId: 'p1', taskDescription: 'd', timestamp: 't' };
    const res = await request(app)
      .post('/webhooks/approval-notification')
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Server misconfiguration');
  });

  it('returns 401 when the signature header is missing', async () => {
    const app = createApp();
    const body = { agentId: 'a1', approvalId: 'p1', taskDescription: 'd', timestamp: 't' };
    const res = await request(app)
      .post('/webhooks/approval-notification')
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid signature');
  });

  it('returns 401 when the signature has the wrong prefix', async () => {
    const app = createApp();
    const body = { agentId: 'a1', approvalId: 'p1', taskDescription: 'd', timestamp: 't' };
    const res = await request(app)
      .post('/webhooks/approval-notification')
      .set('content-type', 'application/json')
      .set('x-inngest-signature', 'md5=abc123')
      .send(body);
    expect(res.status).toBe(401);
  });

  it('returns 401 on signature mismatch', async () => {
    const app = createApp();
    const body = { agentId: 'a1', approvalId: 'p1', taskDescription: 'd', timestamp: 't' };
    const res = await request(app)
      .post('/webhooks/approval-notification')
      .set('content-type', 'application/json')
      .set('x-inngest-signature', sign('different body'))
      .send(body);
    expect(res.status).toBe(401);
  });

  it('returns 400 when required payload fields are missing', async () => {
    const app = createApp();
    const body = { agentId: 'a1', timestamp: 't' }; // missing approvalId + taskDescription
    const raw = JSON.stringify(body);
    const res = await request(app)
      .post('/webhooks/approval-notification')
      .set('content-type', 'application/json')
      .set('x-inngest-signature', sign(raw))
      .send(raw);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing required fields/);
  });

  it('returns 200 on a valid HMAC-signed payload', async () => {
    const app = createApp();
    const body = {
      agentId: 'agent-123',
      approvalId: 'approval-456',
      taskDescription: 'Approve the deployment',
      timestamp: '2026-04-28T00:00:00Z',
    };
    const raw = JSON.stringify(body);
    const res = await request(app)
      .post('/webhooks/approval-notification')
      .set('content-type', 'application/json')
      .set('x-inngest-signature', sign(raw))
      .send(raw);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('rejects a signature of the wrong length (timing-safe early reject)', async () => {
    const app = createApp();
    const body = { agentId: 'a1', approvalId: 'p1', taskDescription: 'd', timestamp: 't' };
    // Truncate the hex digest so received.length !== expected.length
    const validSig = sign(JSON.stringify(body));
    const truncated = validSig.slice(0, validSig.length - 4);
    const res = await request(app)
      .post('/webhooks/approval-notification')
      .set('content-type', 'application/json')
      .set('x-inngest-signature', truncated)
      .send(body);
    expect(res.status).toBe(401);
  });
});
