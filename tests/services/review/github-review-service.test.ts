import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchPullRequestDiff,
  postReviewComments,
  type ReviewComment,
} from '../../../src/services/review/github-review-service.js';

function comment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    path: 'src/foo.ts',
    line: 10,
    body: 'SQL injection risk',
    severity: 'error',
    ruleId: 'sql-injection',
    ...overrides,
  };
}

describe('github-review-service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const fetchMock = () => globalThis.fetch as ReturnType<typeof vi.fn>;

  // ─── fetchPullRequestDiff ──────────────────────────────────────────────────
  describe('fetchPullRequestDiff', () => {
    it('returns the diff text and calls the GitHub PR endpoint', async () => {
      fetchMock().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('diff --git a/x b/x'),
      });
      const diff = await fetchPullRequestDiff('dcyfr-labs', 'dcyfr-ai-api', 7, 'tok');
      expect(diff).toBe('diff --git a/x b/x');
      expect(fetchMock()).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock().mock.calls[0];
      expect(url).toBe('https://api.github.com/repos/dcyfr-labs/dcyfr-ai-api/pulls/7');
      expect(init.headers.Authorization).toBe('Bearer tok');
      expect(init.headers.Accept).toBe('application/vnd.github.diff');
    });

    it('throws on a non-ok response', async () => {
      fetchMock().mockResolvedValueOnce({ ok: false, status: 404 });
      await expect(fetchPullRequestDiff('o', 'r', 1, 'tok')).rejects.toThrow(
        'GitHub API error fetching PR diff (404)',
      );
    });

    it('rejects an invalid owner/repo slug before calling fetch', async () => {
      await expect(fetchPullRequestDiff('bad/owner', 'r', 1, 'tok')).rejects.toThrow(
        'Invalid GitHub owner/repo slug',
      );
      expect(fetchMock()).not.toHaveBeenCalled();
    });
  });

  // ─── postReviewComments ────────────────────────────────────────────────────
  describe('postReviewComments', () => {
    it('makes no GitHub calls when there are no comments', async () => {
      await postReviewComments('o', 'r', 1, [], 'tok');
      expect(fetchMock()).not.toHaveBeenCalled();
    });

    it('skips GitHub calls in dry-run mode', async () => {
      vi.stubEnv('DRY_RUN', 'true');
      await postReviewComments('o', 'r', 1, [comment(), comment({ severity: 'info' })], 'tok');
      expect(fetchMock()).not.toHaveBeenCalled();
    });

    it('posts each comment when DRY_RUN=false', async () => {
      vi.stubEnv('DRY_RUN', 'false');
      fetchMock()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ head: { sha: 'sha123' } }),
        })
        .mockResolvedValueOnce({ ok: true, status: 201 })
        .mockResolvedValueOnce({ ok: true, status: 201 });

      await postReviewComments(
        'o',
        'r',
        9,
        [comment({ severity: 'error' }), comment({ severity: 'warning' })],
        'tok',
      );

      expect(fetchMock()).toHaveBeenCalledTimes(3);
      // First call resolves the PR head commit SHA.
      expect(fetchMock().mock.calls[0][0]).toBe('https://api.github.com/repos/o/r/pulls/9');
      // Subsequent calls post review comments.
      const [postUrl, postInit] = fetchMock().mock.calls[1];
      expect(postUrl).toBe('https://api.github.com/repos/o/r/pulls/9/comments');
      expect(postInit.method).toBe('POST');
      const body = JSON.parse(postInit.body);
      expect(body.commit_id).toBe('sha123');
      expect(body.side).toBe('RIGHT');
      expect(body.path).toBe('src/foo.ts');
      expect(body.body).toContain('🔴'); // error badge
      // Second comment carries the warning badge.
      const warnBody = JSON.parse(fetchMock().mock.calls[2][1].body);
      expect(warnBody.body).toContain('🟡');
    });

    it('continues past a failed comment without throwing', async () => {
      vi.stubEnv('DRY_RUN', 'false');
      fetchMock()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ head: { sha: 's' } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 422,
          text: () => Promise.resolve('unprocessable entity'),
        })
        .mockResolvedValueOnce({ ok: true, status: 201 });

      await expect(
        postReviewComments('o', 'r', 3, [comment(), comment({ severity: 'info' })], 'tok'),
      ).resolves.toBeUndefined();
      expect(fetchMock()).toHaveBeenCalledTimes(3);
    });

    it('throws when the PR head-commit lookup fails', async () => {
      vi.stubEnv('DRY_RUN', 'false');
      fetchMock().mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(
        postReviewComments('o', 'r', 4, [comment()], 'tok'),
      ).rejects.toThrow('GitHub API error fetching PR (500)');
    });
  });
});
