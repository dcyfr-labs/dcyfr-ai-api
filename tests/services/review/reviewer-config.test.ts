import { describe, expect, it } from 'vitest';
import {
  applyConfig,
  parseReviewerConfig,
  shouldSkipFile,
} from '../../../src/services/review/reviewer-config.js';
import { type ReviewComment } from '../../../src/services/review/github-review-service.js';

function comment(
  overrides: Partial<ReviewComment> & { ruleId?: string } = {},
): ReviewComment {
  return {
    path: 'src/foo.ts',
    line: 1,
    body: '**[sql-injection]** SQL injection risk',
    severity: 'error',
    ruleId: 'sql-injection',
    ...overrides,
  };
}

// ─── parseReviewerConfig ─────────────────────────────────────────────────────

describe('parseReviewerConfig', () => {
  it('returns defaults for null input', () => {
    const cfg = parseReviewerConfig(null);
    expect(cfg.severityThreshold).toBe('info');
    expect(cfg.skipPatterns).toEqual([]);
    expect(cfg.skipRules).toEqual([]);
  });

  it('returns defaults for empty object', () => {
    const cfg = parseReviewerConfig({});
    expect(cfg.severityThreshold).toBe('info');
  });

  it('parses valid severityThreshold', () => {
    expect(parseReviewerConfig({ severityThreshold: 'warning' }).severityThreshold).toBe('warning');
    expect(parseReviewerConfig({ severityThreshold: 'error' }).severityThreshold).toBe('error');
  });

  it('falls back to default for invalid severityThreshold', () => {
    expect(parseReviewerConfig({ severityThreshold: 'critical' }).severityThreshold).toBe('info');
    expect(parseReviewerConfig({ severityThreshold: 42 }).severityThreshold).toBe('info');
  });

  it('filters non-string values from skipPatterns', () => {
    const cfg = parseReviewerConfig({ skipPatterns: ['*.test.ts', 42, null, 'src/**'] });
    expect(cfg.skipPatterns).toEqual(['*.test.ts', 'src/**']);
  });

  it('filters non-string values from skipRules', () => {
    const cfg = parseReviewerConfig({ skipRules: ['insecure-random', false] });
    expect(cfg.skipRules).toEqual(['insecure-random']);
  });

  it('accepts a complete valid config', () => {
    const raw = {
      severityThreshold: 'error',
      skipPatterns: ['**/*.min.js'],
      skipRules: ['insecure-random', 'xss-dangerous-html'],
    };
    const cfg = parseReviewerConfig(raw);
    expect(cfg.severityThreshold).toBe('error');
    expect(cfg.skipPatterns).toEqual(['**/*.min.js']);
    expect(cfg.skipRules).toEqual(['insecure-random', 'xss-dangerous-html']);
  });
});

// ─── shouldSkipFile ──────────────────────────────────────────────────────────

describe('shouldSkipFile', () => {
  it('returns false when patterns list is empty', () => {
    expect(shouldSkipFile('src/foo.ts', [])).toBe(false);
  });

  it('matches simple extension glob', () => {
    expect(shouldSkipFile('src/foo.test.ts', ['*.test.ts'])).toBe(true);
    expect(shouldSkipFile('src/foo.ts', ['*.test.ts'])).toBe(false);
  });

  it('matches double-star glob across directories', () => {
    expect(shouldSkipFile('src/components/Button.test.tsx', ['**/*.test.tsx'])).toBe(true);
    expect(shouldSkipFile('src/components/Button.tsx', ['**/*.test.tsx'])).toBe(false);
  });

  it('matches exact path', () => {
    expect(shouldSkipFile('generated/schema.ts', ['generated/schema.ts'])).toBe(true);
    expect(shouldSkipFile('src/schema.ts', ['generated/schema.ts'])).toBe(false);
  });

  it('returns true if any pattern matches', () => {
    expect(shouldSkipFile('dist/bundle.js', ['*.test.ts', 'dist/**'])).toBe(true);
  });
});

// ─── applyConfig ─────────────────────────────────────────────────────────────

describe('applyConfig', () => {
  it('returns all comments when config is default (info threshold, no skips)', () => {
    const comments = [
      comment({ severity: 'error' }),
      comment({ severity: 'warning' }),
      comment({ severity: 'info' }),
    ];
    const result = applyConfig(comments, {
      severityThreshold: 'info',
      skipPatterns: [],
      skipRules: [],
    });
    expect(result).toHaveLength(3);
  });

  it('suppresses info when threshold is warning', () => {
    const comments = [
      comment({ severity: 'error' }),
      comment({ severity: 'warning' }),
      comment({ severity: 'info', ruleId: 'insecure-random' }),
    ];
    const result = applyConfig(comments, {
      severityThreshold: 'warning',
      skipPatterns: [],
      skipRules: [],
    });
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.severity !== 'info')).toBe(true);
  });

  it('suppresses info and warning when threshold is error', () => {
    const comments = [
      comment({ severity: 'error' }),
      comment({ severity: 'warning' }),
      comment({ severity: 'info' }),
    ];
    const result = applyConfig(comments, {
      severityThreshold: 'error',
      skipPatterns: [],
      skipRules: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.severity).toBe('error');
  });

  it('suppresses comments by ruleId', () => {
    const comments = [
      comment({ ruleId: 'sql-injection', severity: 'error' }),
      comment({ ruleId: 'insecure-random', severity: 'info' }),
      comment({ ruleId: 'eval-usage', severity: 'error' }),
    ];
    const result = applyConfig(comments, {
      severityThreshold: 'info',
      skipPatterns: [],
      skipRules: ['insecure-random'],
    });
    expect(result).toHaveLength(2);
    expect(result.some((c) => c.ruleId === 'insecure-random')).toBe(false);
  });

  it('applies both threshold and skipRules together', () => {
    const comments = [
      comment({ ruleId: 'sql-injection', severity: 'error' }),
      comment({ ruleId: 'xss-dangerous-html', severity: 'warning' }),
      comment({ ruleId: 'insecure-random', severity: 'info' }),
    ];
    const result = applyConfig(comments, {
      severityThreshold: 'warning',
      skipPatterns: [],
      skipRules: ['xss-dangerous-html'],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.ruleId).toBe('sql-injection');
  });

  it('keeps comments without a ruleId unless suppressed by severity', () => {
    const comments = [
      comment({ ruleId: undefined, severity: 'warning' }),
    ];
    const result = applyConfig(comments, {
      severityThreshold: 'info',
      skipPatterns: [],
      skipRules: ['sql-injection'],
    });
    expect(result).toHaveLength(1);
  });
});

// ─── fetchReviewerConfig ─────────────────────────────────────────────────────

import { vi, beforeEach, afterEach } from 'vitest';
import { fetchReviewerConfig } from '../../../src/services/review/reviewer-config.js';

describe('fetchReviewerConfig', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns defaults when fetch throws (network error)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ECONNRESET'));
    const cfg = await fetchReviewerConfig('o', 'r', 'token');
    expect(cfg.severityThreshold).toBe('info');
    expect(cfg.skipPatterns).toEqual([]);
  });

  it('returns defaults on 404 (file absent)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 404,
      ok: false,
    });
    const cfg = await fetchReviewerConfig('o', 'r', 'token');
    expect(cfg.severityThreshold).toBe('info');
  });

  it('returns defaults on non-2xx, non-404 response (e.g., 500)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 500,
      ok: false,
    });
    const cfg = await fetchReviewerConfig('o', 'r', 'token');
    expect(cfg.severityThreshold).toBe('info');
  });

  it('returns defaults when response.json() throws', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.reject(new Error('parse error')),
    });
    const cfg = await fetchReviewerConfig('o', 'r', 'token');
    expect(cfg.severityThreshold).toBe('info');
  });

  it('returns defaults when encoding is not base64', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ encoding: 'utf-8', content: 'plain text' }),
    });
    const cfg = await fetchReviewerConfig('o', 'r', 'token');
    expect(cfg.severityThreshold).toBe('info');
  });

  it('returns defaults when base64 content is invalid JSON', async () => {
    const garbage = Buffer.from('not json {').toString('base64');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ encoding: 'base64', content: garbage }),
    });
    const cfg = await fetchReviewerConfig('o', 'r', 'token');
    expect(cfg.severityThreshold).toBe('info');
  });

  it('parses a valid base64-encoded config', async () => {
    const config = {
      severityThreshold: 'error',
      skipPatterns: ['**/*.min.js'],
      skipRules: ['insecure-random'],
    };
    const content = Buffer.from(JSON.stringify(config)).toString('base64');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ encoding: 'base64', content }),
    });
    const cfg = await fetchReviewerConfig('o', 'r', 'token');
    expect(cfg.severityThreshold).toBe('error');
    expect(cfg.skipPatterns).toEqual(['**/*.min.js']);
    expect(cfg.skipRules).toEqual(['insecure-random']);
  });

  it('strips newlines from base64 content before decoding', async () => {
    // GitHub API returns base64 with embedded newlines every 60 chars
    const config = { severityThreshold: 'warning' };
    const raw = Buffer.from(JSON.stringify(config)).toString('base64');
    const withNewlines = raw.replace(/(.{4})/g, '$1\n');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ encoding: 'base64', content: withNewlines }),
    });
    const cfg = await fetchReviewerConfig('o', 'r', 'token');
    expect(cfg.severityThreshold).toBe('warning');
  });
});
