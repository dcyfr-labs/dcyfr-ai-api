/**
 * GitHub webhook route for AI code review.
 * Validates HMAC signature, fetches PR diff, analyzes for security issues,
 * and posts annotated review comments.
 */
import { Router, type Request } from 'express';
import crypto from 'node:crypto';
import { logger } from '../../lib/logger.js';
import { isRepoAllowed } from '../../services/review/repo-allowlist.js';
import { parseDiff } from '../../services/review/diff-analyzer.js';
import {
  fetchPullRequestDiff,
  postReviewComments,
} from '../../services/review/github-review-service.js';
import { analyzeForSecurityIssues } from '../../services/review/security-analyzer.js';
import {
  applyConfig,
  fetchReviewerConfig,
  shouldSkipFile,
} from '../../services/review/reviewer-config.js';

interface GitHubPullRequestPayload {
  action?: string;
  pull_request?: {
    number?: number;
    html_url?: string;
    title?: string;
  };
  repository?: {
    name?: string;
    owner?: { login?: string };
  };
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  if (typeof forwardedValue === 'string' && forwardedValue.trim().length > 0) {
    return forwardedValue.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}

function validateGitHubSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return false;
  const received = Buffer.from(signatureHeader.slice(prefix.length), 'hex');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(received, expected);
}

function createRateLimiter(maxRequests: number, windowMs: number) {
  const requestsByIp = new Map<string, number[]>();
  return (clientIp: string): { limited: boolean; retryAfterSeconds?: number } => {
    const now = Date.now();
    const minTimestamp = now - windowMs;
    const active = (requestsByIp.get(clientIp) ?? []).filter((t) => t > minTimestamp);
    if (active.length >= maxRequests) {
      requestsByIp.set(clientIp, active);
      const oldest = active[0] ?? now;
      return {
        limited: true,
        retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
      };
    }
    active.push(now);
    requestsByIp.set(clientIp, active);
    return { limited: false };
  };
}

export type FetchDiffFn = typeof fetchPullRequestDiff;
export type PostCommentsFn = typeof postReviewComments;

export type FetchConfigFn = typeof fetchReviewerConfig;

async function runReview(
  owner: string,
  repo: string,
  prNumber: number,
  token: string,
  eventId: string,
  fetchDiff: FetchDiffFn,
  postComments: PostCommentsFn,
  fetchConfig: FetchConfigFn,
): Promise<void> {
  const [rawDiff, config] = await Promise.all([
    fetchDiff(owner, repo, prNumber, token),
    fetchConfig(owner, repo, token),
  ]);

  const allFiles = parseDiff(rawDiff);
  const files = allFiles.filter((f) => !shouldSkipFile(f.filename, config.skipPatterns));
  const { comments: rawComments, rulesChecked, filesAnalyzed } = analyzeForSecurityIssues(files);
  const comments = applyConfig(rawComments, config);

  logger.info(
    {
      eventId,
      owner,
      repo,
      prNumber,
      filesAnalyzed,
      rulesChecked,
      findings: rawComments.length,
      afterFilter: comments.length,
      severityThreshold: config.severityThreshold,
    },
    'Security analysis complete',
  );

  await postComments(owner, repo, prNumber, comments, token);
}

export function createReviewGithubWebhookRouter(
  webhookSecret = process.env.REVIEW_WEBHOOK_SECRET ?? process.env.GITHUB_WEBHOOK_SECRET,
  githubToken = process.env.GITHUB_TOKEN,
  fetchDiff: FetchDiffFn = fetchPullRequestDiff,
  postComments: PostCommentsFn = postReviewComments,
  fetchConfig: FetchConfigFn = fetchReviewerConfig,
) {
  const router = Router();
  const rateLimit = createRateLimiter(
    Number(process.env.REVIEW_WEBHOOK_RATE_LIMIT_MAX) || 60,
    Number(process.env.REVIEW_WEBHOOK_RATE_LIMIT_WINDOW_MS) || 60_000,
  );

  router.post('/github-webhook', async (req, res) => {
    if (!webhookSecret) {
      res.status(500).json({ error: 'REVIEW_WEBHOOK_SECRET not configured' });
      return;
    }
    if (!githubToken) {
      res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
      return;
    }

    const clientIp = getClientIp(req);
    const rateLimitResult = rateLimit(clientIp);
    if (rateLimitResult.limited) {
      if (rateLimitResult.retryAfterSeconds !== undefined) {
        res.setHeader('Retry-After', String(rateLimitResult.retryAfterSeconds));
      }
      res.status(429).json({
        error: 'Too many requests',
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
      });
      return;
    }

    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    if (!validateGitHubSignature(rawBody, signature, webhookSecret)) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const githubEvent = req.headers['x-github-event'];
    if (githubEvent !== 'pull_request') {
      res.status(202).json({ accepted: true, skipped: true, reason: 'unsupported_event_type' });
      return;
    }

    const payload = req.body as GitHubPullRequestPayload;
    const action = payload.action;
    if (action !== 'opened' && action !== 'synchronize') {
      res.status(202).json({ accepted: true, skipped: true, reason: 'unsupported_action' });
      return;
    }

    const owner = payload.repository?.owner?.login;
    const repo = payload.repository?.name;
    const prNumber = payload.pull_request?.number;

    if (!owner || !repo || typeof prNumber !== 'number') {
      res.status(400).json({ error: 'Missing required pull request metadata' });
      return;
    }

    // SSRF defense: reject (owner, repo) pairs not in the allowlist before
    // any fetch using our GitHub token. Closes CodeQL js/request-forgery on
    // github-review-service.ts (postReviewComments, fetchPullRequestDiff)
    // and reviewer-config.ts (fetchReviewerConfig).
    if (!isRepoAllowed(owner, repo)) {
      logger.warn({ owner, repo, prNumber }, 'review-webhook: repo not in REVIEW_ALLOWED_REPOS — rejecting');
      res.status(403).json({ error: 'Repository not authorized for review service' });
      return;
    }

    const eventId = (req.headers['x-github-delivery'] as string | undefined) ?? crypto.randomUUID();
    res.status(202).json({ accepted: true, eventId });

    setImmediate(() => {
      runReview(owner, repo, prNumber, githubToken!, eventId, fetchDiff, postComments, fetchConfig).catch(
        (err: unknown) => {
          logger.error({ eventId, owner, repo, prNumber, err }, 'Failed to run PR security review');
        },
      );
    });
  });

  return router;
}
