/**
 * Tests for ApnsTokenManager — APNS device token lifecycle + delivery.
 *
 * Uses an in-memory SQLite via APNS_DB_PATH=":memory:" so tests stay
 * isolated from the file-backed prod DB.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.APNS_DB_PATH = ':memory:';
  process.env.APNS_ENABLED = 'false';
  vi.resetModules();
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function loadManager() {
  const mod = await import('../../src/services/apns-token-manager.js');
  return new mod.ApnsTokenManager();
}

const TOKEN_A = 'a'.repeat(64);
const TOKEN_B = 'b'.repeat(64);

describe('ApnsTokenManager.registerToken', () => {
  it('inserts a new token as active', async () => {
    const mgr = await loadManager();
    mgr.registerToken('agent-1', TOKEN_A, 'fp-1');
    const tokens = await mgr.getActiveTokens('agent-1');
    expect(tokens).toEqual([TOKEN_A]);
  });

  it('upserts on conflict — re-registering re-activates and refreshes fields', async () => {
    const mgr = await loadManager();
    mgr.registerToken('agent-1', TOKEN_A, 'fp-1');
    mgr.deactivateToken(TOKEN_A);
    expect(await mgr.getActiveTokens('agent-1')).toEqual([]);

    // Re-register the same deviceToken under a different agent + fp
    mgr.registerToken('agent-2', TOKEN_A, 'fp-new');
    expect(await mgr.getActiveTokens('agent-1')).toEqual([]);
    expect(await mgr.getActiveTokens('agent-2')).toEqual([TOKEN_A]);
  });

  it('supports multiple tokens per agent', async () => {
    const mgr = await loadManager();
    mgr.registerToken('agent-1', TOKEN_A, 'fp-a');
    mgr.registerToken('agent-1', TOKEN_B, 'fp-b');
    const tokens = await mgr.getActiveTokens('agent-1');
    expect(tokens).toHaveLength(2);
    expect(tokens).toContain(TOKEN_A);
    expect(tokens).toContain(TOKEN_B);
  });
});

describe('ApnsTokenManager.deactivateToken', () => {
  it('removes a token from getActiveTokens', async () => {
    const mgr = await loadManager();
    mgr.registerToken('agent-1', TOKEN_A, 'fp');
    mgr.deactivateToken(TOKEN_A);
    expect(await mgr.getActiveTokens('agent-1')).toEqual([]);
  });

  it('is a no-op for an unknown token', async () => {
    const mgr = await loadManager();
    expect(() => mgr.deactivateToken('z'.repeat(64))).not.toThrow();
  });
});

describe('ApnsTokenManager.getActiveTokens', () => {
  it('returns [] for an agent with no tokens', async () => {
    const mgr = await loadManager();
    expect(await mgr.getActiveTokens('unknown')).toEqual([]);
  });

  it('does not return tokens registered for other agents', async () => {
    const mgr = await loadManager();
    mgr.registerToken('agent-1', TOKEN_A, 'fp-a');
    mgr.registerToken('agent-2', TOKEN_B, 'fp-b');
    expect(await mgr.getActiveTokens('agent-1')).toEqual([TOKEN_A]);
    expect(await mgr.getActiveTokens('agent-2')).toEqual([TOKEN_B]);
  });
});

describe('ApnsTokenManager.sendNotifications (APNS_ENABLED=false dev path)', () => {
  it('logs and no-ops when APNS_ENABLED is not "true"', async () => {
    const mgr = await loadManager();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    await mgr.sendNotifications([TOKEN_A, TOKEN_B], {
      title: 'Approve',
      body: 'Pending review',
      data: { approvalId: 'p1' },
    });
    // Three console.info lines: APNS disabled, would-send, payload
    expect(infoSpy).toHaveBeenCalledWith(
      '[apns] APNS_ENABLED=false — notifications suppressed (dev mode)',
    );
    expect(infoSpy).toHaveBeenCalledWith(
      '[apns] Would send to tokens:',
      expect.arrayContaining([expect.stringContaining('…')]),
    );
  });

  it('does not throw on empty token list (dev mode)', async () => {
    const mgr = await loadManager();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await expect(mgr.sendNotifications([], { title: 't', body: 'b' })).resolves.toBeUndefined();
  });
});

// ─── Production path (APNS_ENABLED=true) ─────────────────────────────────────

import crypto from 'node:crypto';

/** Generate a real ES256 keypair so buildApnsJwt's crypto.createSign() works. */
function generateApnsKeyEnv(): { privateKeyB64: string } {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  return { privateKeyB64: Buffer.from(pem, 'utf8').toString('base64') };
}

async function loadManagerProduction(opts: { sandbox?: boolean } = {}) {
  process.env.APNS_ENABLED = 'true';
  process.env.APNS_KEY_ID = 'KEY123';
  process.env.APNS_TEAM_ID = 'TEAM456';
  process.env.APNS_BUNDLE_ID = 'ai.rei.gateway';
  process.env.APNS_PRIVATE_KEY = generateApnsKeyEnv().privateKeyB64;
  if (opts.sandbox) process.env.APNS_SANDBOX = 'true';
  vi.resetModules();
  const mod = await import('../../src/services/apns-token-manager.js');
  return new mod.ApnsTokenManager();
}

describe('ApnsTokenManager.sendNotifications (APNS_ENABLED=true production path)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('builds a JWT and POSTs to api.push.apple.com/3/device/<token> by default', async () => {
    const mgr = await loadManagerProduction();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });
    vi.stubGlobal('fetch', fetchMock);

    await mgr.sendNotifications([TOKEN_A], { title: 't', body: 'b' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`https://api.push.apple.com/3/device/${TOKEN_A}`);
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toMatch(/^bearer ey/); // JWT header is base64url-encoded "{...}"
    expect(headers['apns-topic']).toBe('ai.rei.gateway');
    expect(headers['apns-push-type']).toBe('alert');
    expect(headers['content-type']).toBe('application/json');
    const body = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
    expect((body as { aps: { alert: { title: string; body: string } } }).aps.alert).toEqual({ title: 't', body: 'b' });
  });

  it('targets the sandbox host when APNS_SANDBOX=true', async () => {
    const mgr = await loadManagerProduction({ sandbox: true });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });
    vi.stubGlobal('fetch', fetchMock);

    await mgr.sendNotifications([TOKEN_A], { title: 't', body: 'b' });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`https://api.sandbox.push.apple.com/3/device/${TOKEN_A}`);
  });

  it('flattens payload.data fields into the notification body alongside aps', async () => {
    const mgr = await loadManagerProduction();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });
    vi.stubGlobal('fetch', fetchMock);

    await mgr.sendNotifications([TOKEN_A], {
      title: 't',
      body: 'b',
      data: { approvalId: 'p1', agentId: 'a1' },
    });

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.approvalId).toBe('p1');
    expect(body.agentId).toBe('a1');
    expect((body as { aps: unknown }).aps).toBeDefined();
  });

  it('deactivates the token on a 410 response', async () => {
    const mgr = await loadManagerProduction();
    mgr.registerToken('agent-1', TOKEN_A, 'fp');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 410,
      text: () => Promise.resolve('DeviceTokenNoLongerActive'),
    });
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await mgr.sendNotifications([TOKEN_A], { title: 't', body: 'b' });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Token deactivated (410)'),
    );
    // Token should now be inactive
    expect(await mgr.getActiveTokens('agent-1')).toEqual([]);
  });

  it('logs an error on non-2xx, non-410 responses', async () => {
    const mgr = await loadManagerProduction();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    });
    vi.stubGlobal('fetch', fetchMock);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await mgr.sendNotifications([TOKEN_A], { title: 't', body: 'b' });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Delivery failed'),
    );
  });

  it('logs an error when fetch throws (network failure)', async () => {
    const mgr = await loadManagerProduction();
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    vi.stubGlobal('fetch', fetchMock);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await mgr.sendNotifications([TOKEN_A], { title: 't', body: 'b' });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Request error'),
      expect.any(Error),
    );
  });

  it('processes multiple tokens via Promise.allSettled (no early bail on one failure)', async () => {
    const mgr = await loadManagerProduction();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve('') })
      .mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve('') });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await mgr.sendNotifications([TOKEN_A, TOKEN_B], { title: 't', body: 'b' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
