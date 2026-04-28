/**
 * Tests for /api/devices route — APNS token registration + deactivation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { ApnsTokenManager } from '../../src/services/apns-token-manager.js';

const VALID_TOKEN = 'a'.repeat(64);

describe('POST /api/devices/register', () => {
  beforeEach(() => {
    vi.spyOn(ApnsTokenManager.prototype, 'registerToken').mockImplementation(() => {});
  });

  it('returns 201 with registered=true on a well-formed payload', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/devices/register')
      .send({
        agentId: 'agent-1',
        deviceToken: VALID_TOKEN,
        deviceFingerprint: 'fp-abc',
      });
    expect(res.status).toBe(201);
    expect(res.body.registered).toBe(true);
  });

  it('returns 400 when agentId is missing', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/devices/register')
      .send({ deviceToken: VALID_TOKEN, deviceFingerprint: 'fp' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing required fields/);
  });

  it('returns 400 when deviceToken is missing', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/devices/register')
      .send({ agentId: 'a', deviceFingerprint: 'fp' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when deviceFingerprint is missing', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/devices/register')
      .send({ agentId: 'a', deviceToken: VALID_TOKEN });
    expect(res.status).toBe(400);
  });

  it('returns 400 when deviceToken is not 64-char hex', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/devices/register')
      .send({
        agentId: 'a',
        deviceToken: 'too-short',
        deviceFingerprint: 'fp',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid deviceToken format/);
  });

  it('returns 400 when deviceToken contains non-hex chars', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/devices/register')
      .send({
        agentId: 'a',
        deviceToken: 'z'.repeat(64),
        deviceFingerprint: 'fp',
      });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/devices/:token', () => {
  beforeEach(() => {
    vi.spyOn(ApnsTokenManager.prototype, 'deactivateToken').mockImplementation(() => {});
  });

  it('returns 200 with deactivated=true', async () => {
    const app = createApp();
    const res = await request(app).delete(`/api/devices/${VALID_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.deactivated).toBe(true);
  });
});
