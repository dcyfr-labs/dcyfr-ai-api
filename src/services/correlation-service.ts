/**
 * Correlation service: GitHub PR events -> Linear issue match -> mapping store.
 */
import { logger } from '../lib/logger.js';
import { MappingStore, type MappingSource } from './mapping-store.js';

export interface PullRequestCorrelationEvent {
  eventId: string;
  action: string;
  owner: string;
  repo: string;
  prNumber: number;
  prUrl?: string;
  title?: string;
  body?: string;
  branch?: string;
  commits?: string[];
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title?: string;
}

export interface LinearIssueResolver {
  findByIdentifier(identifier: string): Promise<LinearIssue | null>;
}

export interface CorrelationResult {
  matched: boolean;
  linearIssueId?: string;
  identifier?: string;
  source?: MappingSource;
  confidence?: number;
  mappingId?: number;
  reason?: string;
}

interface Candidate {
  identifier: string;
  source: MappingSource;
  confidence: number;
}

const ISSUE_KEY_PATTERN = /\b([A-Z]{2,12}-\d{1,7})\b/g;

export class NoopLinearIssueResolver implements LinearIssueResolver {
  async findByIdentifier(_identifier: string): Promise<LinearIssue | null> {
    return null;
  }
}

export class LinearGraphqlIssueResolver implements LinearIssueResolver {
  constructor(
    private readonly apiKey: string,
    private readonly endpoint = 'https://api.linear.app/graphql',
  ) { }

  async findByIdentifier(identifier: string): Promise<LinearIssue | null> {
    // Identifier format: TEAM_KEY-NUMBER (e.g. "DCYFR-123")
    // IssueFilter does not expose `identifier` directly — split into team key + number.
    const match = /^([A-Z]{2,12})-(\d{1,7})$/.exec(identifier);
    if (!match) return null;
    const teamKey = match[1]!;
    const issueNumber = parseInt(match[2]!, 10);

    const query = `
      query FindIssueByTeamKeyAndNumber($teamKey: String!, $number: Float!) {
        issues(filter: { team: { key: { eq: $teamKey } }, number: { eq: $number } }, first: 1) {
          nodes {
            id
            identifier
            title
          }
        }
      }
    `;

    const startedAt = Date.now();
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { teamKey, number: issueNumber } }),
    });

    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      logger.warn(
        {
          timestamp: new Date().toISOString(),
          action: 'linear_lookup',
          status: 'http_error',
          metadata: { identifier, status: response.status, durationMs },
        },
        'Linear API request failed',
      );
      return null;
    }

    const payload = (await response.json()) as {
      data?: { issues?: { nodes?: Array<LinearIssue> } };
      errors?: unknown[];
    };

    if (payload.errors?.length) {
      logger.warn(
        {
          timestamp: new Date().toISOString(),
          action: 'linear_lookup',
          status: 'graphql_error',
          metadata: { identifier, errorCount: payload.errors.length, durationMs },
        },
        'Linear GraphQL errors returned',
      );
      return null;
    }

    const issue = payload.data?.issues?.nodes?.[0] ?? null;

    logger.info(
      {
        timestamp: new Date().toISOString(),
        action: 'linear_lookup',
        status: issue ? 'matched' : 'not_found',
        metadata: { identifier, durationMs },
      },
      'Linear lookup complete',
    );

    return issue;
  }
}

export class CorrelationService {
  constructor(
    private readonly mappingStore: MappingStore,
    private readonly linearResolver: LinearIssueResolver,
  ) { }

  async correlatePullRequest(event: PullRequestCorrelationEvent): Promise<CorrelationResult> {
    const candidates = this.extractIssueCandidates(event);

    if (candidates.length === 0) {
      logger.info(
        {
          timestamp: new Date().toISOString(),
          eventId: event.eventId,
          action: 'correlation_attempt',
          status: 'no_identifier',
          metadata: { owner: event.owner, repo: event.repo, prNumber: event.prNumber },
        },
        'No issue identifier found in PR metadata',
      );

      return { matched: false, reason: 'no_identifier' };
    }

    const best = candidates[0]!;
    const issue = await this.linearResolver.findByIdentifier(best.identifier);

    if (!issue) {
      logger.info(
        {
          timestamp: new Date().toISOString(),
          eventId: event.eventId,
          action: 'correlation_attempt',
          status: 'linear_issue_not_found',
          metadata: {
            identifier: best.identifier,
            source: best.source,
            confidence: best.confidence,
          },
        },
        'Identifier found but no matching Linear issue',
      );

      return {
        matched: false,
        identifier: best.identifier,
        source: best.source,
        confidence: best.confidence,
        reason: 'linear_issue_not_found',
      };
    }

    const mapping = await this.mappingStore.upsert({
      linearIssueId: issue.id,
      linearIdentifier: issue.identifier,
      owner: event.owner,
      repo: event.repo,
      prNumber: event.prNumber,
      prUrl: event.prUrl ?? null,
      source: best.source,
      confidence: Math.round(best.confidence * 100),
      syncStatus: 'pending',
    });

    logger.info(
      {
        timestamp: new Date().toISOString(),
        eventId: event.eventId,
        action: 'correlation_attempt',
        status: 'matched',
        metadata: {
          identifier: issue.identifier,
          source: best.source,
          confidence: best.confidence,
          mappingId: mapping.id,
          owner: event.owner,
          repo: event.repo,
          prNumber: event.prNumber,
        },
      },
      'PR successfully correlated to Linear issue',
    );

    return {
      matched: true,
      linearIssueId: issue.id,
      identifier: issue.identifier,
      source: best.source,
      confidence: best.confidence,
      mappingId: mapping.id,
    };
  }

  private extractIssueCandidates(event: PullRequestCorrelationEvent): Candidate[] {
    const candidates: Candidate[] = [];

    this.collectCandidates(event.branch, 'branch', 0.95, candidates);
    this.collectCandidates(event.title, 'title', 0.85, candidates);

    for (const commit of event.commits ?? []) {
      this.collectCandidates(commit, 'commit', 0.75, candidates);
    }

    this.collectCandidates(event.body, 'body', 0.6, candidates);

    const deduped = new Map<string, Candidate>();
    for (const candidate of candidates) {
      const existing = deduped.get(candidate.identifier);
      if (!existing || candidate.confidence > existing.confidence) {
        deduped.set(candidate.identifier, candidate);
      }
    }

    return [...deduped.values()].sort((a, b) => b.confidence - a.confidence);
  }

  private collectCandidates(
    value: string | undefined,
    source: MappingSource,
    confidence: number,
    target: Candidate[],
  ): void {
    if (!value) return;

    const matches = value.matchAll(ISSUE_KEY_PATTERN);
    for (const match of matches) {
      const identifier = match[1]?.toUpperCase();
      if (!identifier) continue;
      target.push({ identifier, source, confidence });
    }
  }
}
