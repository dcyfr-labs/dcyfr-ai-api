/**
 * GitHub webhook ingest route for Linear correlation.
 */
import { Router, type Request } from 'express';
import crypto from 'node:crypto';
import { db } from '../../db/connection.js';
import { logger } from '../../lib/logger.js';
import {
  CorrelationService,
  LinearGraphqlIssueResolver,
  NoopLinearIssueResolver,
  type PullRequestCorrelationEvent,
} from '../../services/correlation-service.js';
import {
  LinearGraphqlWriteClient,
  LinearSyncService,
  NoopLinearWriteClient,
} from '../../services/linear-sync-service.js';
import { MappingStore } from '../../services/mapping-store.js';

interface GitHubPullRequestPayload {
  action?: string;
  pull_request?: {
    number?: number;
    html_url?: string;
    title?: string;
    body?: string;
    head?: { ref?: string };
  };
  repository?: {
    name?: string;
    owner?: { login?: string };
  };
  sender?: { login?: string };
}

interface LinearWebhookRateLimitConfig {
  maxRequests: number;
  windowMs: number;
  now?: () => number;
}

interface LinearWebhookRateLimitResult {
  limited: boolean;
  retryAfterSeconds?: number;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function buildDefaultRateLimitConfig(): LinearWebhookRateLimitConfig {
  return {
    maxRequests: parsePositiveInteger(process.env.LINEAR_WEBHOOK_RATE_LIMIT_MAX, 120),
    windowMs: parsePositiveInteger(process.env.LINEAR_WEBHOOK_RATE_LIMIT_WINDOW_MS, 60_000),
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

function createRateLimiter(config: LinearWebhookRateLimitConfig) {
  const requestsByIp = new Map<string, number[]>();

  return (clientIp: string): LinearWebhookRateLimitResult => {
    const now = config.now?.() ?? Date.now();
    const minTimestamp = now - config.windowMs;
    const activeTimestamps = (requestsByIp.get(clientIp) ?? []).filter((timestamp) => timestamp > minTimestamp);

    if (activeTimestamps.length >= config.maxRequests) {
      requestsByIp.set(clientIp, activeTimestamps);

      const oldest = activeTimestamps[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((config.windowMs - (now - oldest)) / 1000));
      return { limited: true, retryAfterSeconds };
    }

    activeTimestamps.push(now);
    requestsByIp.set(clientIp, activeTimestamps);

    return { limited: false };
  };
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

function resolveRawBody(req: Request): string {
  const rawBodyValue = (req as unknown as { rawBody?: unknown }).rawBody;

  if (typeof rawBodyValue === 'string') {
    return rawBodyValue;
  }

  if (Buffer.isBuffer(rawBodyValue)) {
    return rawBodyValue.toString();
  }

  if (typeof req.body === 'string') {
    return req.body;
  }

  if (req.body === undefined || req.body === null) {
    return '';
  }

  try {
    return JSON.stringify(req.body);
  } catch {
    return '';
  }
}

function toCorrelationEvent(payload: GitHubPullRequestPayload, eventId: string): PullRequestCorrelationEvent | null {
  const owner = payload.repository?.owner?.login;
  const repo = payload.repository?.name;
  const prNumber = payload.pull_request?.number;

  if (!owner || !repo || typeof prNumber !== 'number') {
    return null;
  }

  return {
    eventId,
    action: payload.action ?? 'unknown',
    owner,
    repo,
    prNumber,
    prUrl: payload.pull_request?.html_url,
    title: payload.pull_request?.title,
    body: payload.pull_request?.body,
    branch: payload.pull_request?.head?.ref,
    commits: [],
  };
}

function buildCorrelationService() {
  const mappingStore = new MappingStore(db);
  const linearApiKey = process.env.LINEAR_API_KEY;
  const isRealKey = linearApiKey && !linearApiKey.startsWith('replace-with-');

  if (!isRealKey) {
    logger.warn({ action: 'linear_key_check' }, 'LINEAR_API_KEY is absent or a placeholder — Linear lookups will be no-ops');
  }

  const resolver = isRealKey
    ? new LinearGraphqlIssueResolver(linearApiKey)
    : new NoopLinearIssueResolver();

  return new CorrelationService(mappingStore, resolver);
}

function buildLinearSyncService() {
  const linearApiKey = process.env.LINEAR_API_KEY;
  const isRealKey = linearApiKey && !linearApiKey.startsWith('replace-with-');
  const dryRun = (process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';

  const client = isRealKey
    ? new LinearGraphqlWriteClient(linearApiKey)
    : new NoopLinearWriteClient();

  return new LinearSyncService(client, dryRun);
}

export function createLinearGithubWebhookRouter(
  service: Pick<CorrelationService, 'correlatePullRequest'> = buildCorrelationService(),
  syncService: Pick<LinearSyncService, 'syncPrOpened'> = buildLinearSyncService(),
  webhookSecret = process.env.GITHUB_WEBHOOK_SECRET,
  rateLimitConfig: LinearWebhookRateLimitConfig = buildDefaultRateLimitConfig(),
) {
  const router = Router();
  const rateLimit = createRateLimiter(rateLimitConfig);

  router.post('/github-webhook', async (req, res) => {
    if (!webhookSecret) {
      res.status(500).json({ error: 'GITHUB_WEBHOOK_SECRET not configured' });
      return;
    }

    const clientIp = getClientIp(req);
    const rateLimitResult = rateLimit(clientIp);

    if (rateLimitResult.limited) {
      if (typeof rateLimitResult.retryAfterSeconds === 'number') {
        res.setHeader('Retry-After', String(rateLimitResult.retryAfterSeconds));
      }

      logger.warn(
        {
          action: 'github_webhook_rate_limited',
          metadata: {
            clientIp,
            maxRequests: rateLimitConfig.maxRequests,
            windowMs: rateLimitConfig.windowMs,
          },
        },
        'Linear GitHub webhook request was rate limited',
      );

      res.status(429).json({
        error: 'Too many requests',
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
      });
      return;
    }

    const rawBody = resolveRawBody(req);
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

    const eventId = (req.headers['x-github-delivery'] as string | undefined) ?? crypto.randomUUID();
    const payload = req.body as GitHubPullRequestPayload;
    const event = toCorrelationEvent(payload, eventId);

    if (!event) {
      res.status(400).json({ error: 'Missing required pull request metadata' });
      return;
    }

    // Accept quickly; process asynchronously to keep webhook handler responsive.
    res.status(202).json({ accepted: true, eventId });

    setImmediate(() => {
      service
        .correlatePullRequest(event)
        .then(async (result) => {
          if (result.matched && result.identifier && result.linearIssueId) {
            await syncService.syncPrOpened({
              eventId,
              issueId: result.linearIssueId,
              issueIdentifier: result.identifier,
              owner: event.owner,
              repo: event.repo,
              prNumber: event.prNumber,
              prUrl: event.prUrl,
            });
          }

          logger.info(
            {
              timestamp: new Date().toISOString(),
              eventId,
              action: 'github_webhook_ingest',
              status: 'processed',
              metadata: {
                matched: result.matched,
                identifier: result.identifier,
                source: result.source,
                confidence: result.confidence,
                mappingId: result.mappingId,
              },
            },
            'GitHub webhook processed',
          );
        })
        .catch((error: unknown) => {
          logger.error(
            {
              timestamp: new Date().toISOString(),
              eventId,
              action: 'github_webhook_ingest',
              status: 'failed',
              metadata: { error: error instanceof Error ? error.message : String(error) },
            },
            'Failed to process GitHub webhook',
          );
        });
    });
  });

  return router;
}
