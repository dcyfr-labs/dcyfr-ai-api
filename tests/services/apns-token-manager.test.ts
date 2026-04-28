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
