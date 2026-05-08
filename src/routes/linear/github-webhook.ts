/**
 * GitHub webhook ingest route for Linear correlation.
 */
import { Router, type Request } from 'express';
import crypto from 'node:crypto';
import { db } from '../../db/connection.js';
import { logger } from '../../lib/logger.js';
import { funnelWebhookRequests, type FunnelWebhookResult } from '../../lib/metrics.js';
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
import { DeadLetterService } from '../../services/dead-letter-service.js';
import { MappingStore } from '../../services/mapping-store.js';
import { isRepoAllowed } from '../../services/review/repo-allowlist.js';

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

const PROCESSED_ACTIONS = new Set(['opened', 'synchronize']);

function toCorrelationEvent(payload: GitHubPullRequestPayload, eventId: string): PullRequestCorrelationEvent | null {
  const owner = payload.repository?.owner?.login;
  const repo = payload.repository?.name;
  const prNumber = payload.pull_request?.number;

  if (!owner || !repo || typeof prNumber !== 'number') {
    return null;
  }

  // SSRF defense: reject (owner, repo) not in REVIEW_ALLOWED_REPOS before
  // the downstream fetch (line 151) — closes CodeQL js/request-forgery on
  // routes/linear/github-webhook.ts.
  if (!isRepoAllowed(owner, repo)) {
    logger.warn({ owner, repo, prNumber, eventId }, 'linear-webhook: repo not in REVIEW_ALLOWED_REPOS — rejecting');
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

/** Fetch the first-line of each commit message for the given PR. Returns [] on any error. */
async function fetchPrCommitMessages(
  owner: string,
  repo: string,
  prNumber: number,
  githubToken: string,
): Promise<string[]> {
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo)) {
    return [];
  }
  // URL constructor with hardcoded base binds host to api.github.com.
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/commits?per_page=100`;
  const url = new URL(path, 'https://api.github.com').toString();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch {
    return [];
  }
  if (!response.ok) return [];

  const commits = (await response.json()) as Array<{ commit?: { message?: string } }>;
  return commits
    .map((c) => (c.commit?.message ?? '').split('\n')[0]?.trim() ?? '')
    .filter(Boolean);
}

function isRealApiKey(value: string | undefined): value is string {
  if (!value) return false;
  if (value.startsWith('replace-with-')) return false;
  if (value.startsWith('op://')) return false;
  return true;
}

function buildCorrelationService() {
  const mappingStore = new MappingStore(db);
  const linearApiKey = process.env.LINEAR_API_KEY;

  if (!isRealApiKey(linearApiKey)) {
    logger.warn({ action: 'linear_key_check' }, 'LINEAR_API_KEY is absent or a placeholder — Linear lookups will be no-ops');
  }

  const resolver = isRealApiKey(linearApiKey)
    ? new LinearGraphqlIssueResolver(linearApiKey)
    : new NoopLinearIssueResolver();

  return new CorrelationService(mappingStore, resolver);
}

function buildLinearSyncService() {
  const linearApiKey = process.env.LINEAR_API_KEY;
  const dryRun = (process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';

  const client = isRealApiKey(linearApiKey)
    ? new LinearGraphqlWriteClient(linearApiKey)
    : new NoopLinearWriteClient();

  return new LinearSyncService(client, dryRun);
}

function buildDeadLetterService() {
  return new DeadLetterService(db);
}

async function processPullRequestEvent(
  event: PullRequestCorrelationEvent,
  service: Pick<CorrelationService, 'correlatePullRequest'>,
  syncService: Pick<LinearSyncService, 'syncPrOpened'>,
): Promise<void> {
  const result = await service.correlatePullRequest(event);

  if (result.matched && result.identifier && result.linearIssueId) {
    await syncService.syncPrOpened({
      eventId: event.eventId,
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
      eventId: event.eventId,
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
}

export function createLinearGithubWebhookRouter(
  service: Pick<CorrelationService, 'correlatePullRequest'> = buildCorrelationService(),
  syncService: Pick<LinearSyncService, 'syncPrOpened'> = buildLinearSyncService(),
  webhookSecret = process.env.GITHUB_WEBHOOK_SECRET,
  rateLimitConfig: LinearWebhookRateLimitConfig = buildDefaultRateLimitConfig(),
  deadLetterService: Pick<DeadLetterService, 'record' | 'getPending' | 'getByEventId' | 'markProcessed'> = buildDeadLetterService(),
) {
  const router = Router();
  const rateLimit = createRateLimiter(rateLimitConfig);

  router.post('/github-webhook', async (req, res) => {
    // Single entry point for Funnel-exposed webhook telemetry. Every branch
    // below calls recordResult() exactly once — keep it that way so the
    // counter is a reliable divisor for alert rules in Phase 6.2.
    const recordResult = (result: FunnelWebhookResult): void => {
      funnelWebhookRequests.inc({ route: 'linear_github_webhook', result });
    };

    if (!webhookSecret) {
      recordResult('missing_secret');
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

      recordResult('rate_limited');
      res.status(429).json({
        error: 'Too many requests',
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
      });
      return;
    }

    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
    const signature = req.headers['x-hub-signature-256'] as string | undefined;

    if (!validateGitHubSignature(rawBody, signature, webhookSecret)) {
      recordResult('invalid_signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const githubEvent = req.headers['x-github-event'];
    if (githubEvent !== 'pull_request') {
      recordResult('unsupported_event');
      res.status(202).json({ accepted: true, skipped: true, reason: 'unsupported_event_type' });
      return;
    }

    const eventId = (req.headers['x-github-delivery'] as string | undefined) ?? crypto.randomUUID();
    const payload = req.body as GitHubPullRequestPayload;
    const event = toCorrelationEvent(payload, eventId);

    if (!event) {
      recordResult('missing_metadata');
      res.status(400).json({ error: 'Missing required pull request metadata' });
      return;
    }

    if (!PROCESSED_ACTIONS.has(event.action)) {
      recordResult('unsupported_action');
      res.status(202).json({ accepted: true, skipped: true, reason: 'unsupported_action' });
      return;
    }

    // Accept quickly; process asynchronously to keep webhook handler responsive.
    recordResult('accepted');
    res.status(202).json({ accepted: true, eventId });

    setImmediate(() => {
      const githubToken = process.env.GITHUB_TOKEN;
      const enrichPromise = isRealApiKey(githubToken)
        ? fetchPrCommitMessages(event.owner, event.repo, event.prNumber, githubToken).then(
            (msgs) => { event.commits = msgs; },
          )
        : Promise.resolve();

      enrichPromise
        .then(() => processPullRequestEvent(event, service, syncService))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);

          void deadLetterService.record({
            eventId,
            payload: rawBody,
            error: message,
            source: 'github',
            eventType: 'pull_request',
          }).catch((deadLetterError: unknown) => {
            logger.error(
              {
                timestamp: new Date().toISOString(),
                eventId,
                action: 'github_webhook_dead_letter_record',
                status: 'failed',
                metadata: {
                  error: deadLetterError instanceof Error ? deadLetterError.message : String(deadLetterError),
                },
              },
              'Failed to persist dead-letter event',
            );
          });

          logger.error(
            {
              timestamp: new Date().toISOString(),
              eventId,
              action: 'github_webhook_ingest',
              status: 'failed',
              metadata: { error: message },
            },
            'Failed to process GitHub webhook',
          );
        });
    });
  });

  router.get('/dead-letter', async (_req, res) => {
    const events = await deadLetterService.getPending();

    res.json({
      data: events.map((event) => ({
        id: event.id,
        eventId: event.eventId,
        source: event.source,
        eventType: event.eventType,
        error: event.error,
        createdAt: event.createdAt,
      })),
    });
  });

  router.post('/replay/:eventId', async (req, res) => {
    const eventId = req.params['eventId'];
    if (!eventId) {
      res.status(400).json({ error: 'Missing eventId' });
      return;
    }

    const deadLetterEvent = await deadLetterService.getByEventId(eventId);
    if (!deadLetterEvent) {
      res.status(404).json({ error: 'Dead-letter event not found' });
      return;
    }

    if (deadLetterEvent.source !== 'github' || deadLetterEvent.eventType !== 'pull_request') {
      res.status(400).json({ error: 'Unsupported dead-letter event type' });
      return;
    }

    let payload: GitHubPullRequestPayload;
    try {
      payload = JSON.parse(deadLetterEvent.payload) as GitHubPullRequestPayload;
    } catch {
      res.status(400).json({ error: 'Dead-letter payload is not valid JSON' });
      return;
    }

    const correlationEvent = toCorrelationEvent(payload, eventId);

    if (!correlationEvent) {
      res.status(400).json({ error: 'Dead-letter payload missing required pull request metadata' });
      return;
    }

    await processPullRequestEvent(correlationEvent, service, syncService);
    await deadLetterService.markProcessed(eventId);

    res.json({ replayed: true, eventId });
  });

  return router;
}
