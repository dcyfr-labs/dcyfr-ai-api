/**
 * GitHub webhook ingest route for Linear correlation.
 */
import { Router } from 'express';
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

  const resolver = linearApiKey
    ? new LinearGraphqlIssueResolver(linearApiKey)
    : new NoopLinearIssueResolver();

  return new CorrelationService(mappingStore, resolver);
}

function buildLinearSyncService() {
  const linearApiKey = process.env.LINEAR_API_KEY;
  const dryRun = (process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';

  const client = linearApiKey
    ? new LinearGraphqlWriteClient(linearApiKey)
    : new NoopLinearWriteClient();

  return new LinearSyncService(client, dryRun);
}

export function createLinearGithubWebhookRouter(
  service: Pick<CorrelationService, 'correlatePullRequest'> = buildCorrelationService(),
  syncService: Pick<LinearSyncService, 'syncPrOpened'> = buildLinearSyncService(),
  webhookSecret = process.env.GITHUB_WEBHOOK_SECRET,
) {
  const router = Router();

  router.post('/github-webhook', async (req, res) => {
    if (!webhookSecret) {
      res.status(500).json({ error: 'GITHUB_WEBHOOK_SECRET not configured' });
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
