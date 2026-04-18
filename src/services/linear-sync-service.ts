/**
 * Read-only Linear sync service for Phase 2 MVP.
 */
import { logger } from '../lib/logger.js';

export interface LinearWriteClient {
  addComment(issueId: string, body: string): Promise<void>;
  addLabel(issueId: string, labelName: string): Promise<void>;
}

export class NoopLinearWriteClient implements LinearWriteClient {
  async addComment(_issueId: string, _body: string): Promise<void> {
    // no-op
  }

  async addLabel(_issueId: string, _labelName: string): Promise<void> {
    // no-op
  }
}

export class LinearGraphqlWriteClient implements LinearWriteClient {
  constructor(
    private readonly apiKey: string,
    private readonly endpoint = 'https://api.linear.app/graphql',
  ) { }

  async addComment(issueId: string, body: string): Promise<void> {
    const mutation = `
      mutation CreateComment($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          success
        }
      }
    `;

    await this.callLinear(mutation, { input: { issueId, body } }, 'linear_comment_create');
  }

  async addLabel(issueId: string, labelName: string): Promise<void> {
    // Fetch the issue's current labels and its team's label catalog in one round-trip.
    const issueQuery = `
      query GetIssueLabelsAndTeam($id: String!) {
        issue(id: $id) {
          labels { nodes { id name } }
          team {
            id
            labels { nodes { id name } }
          }
        }
      }
    `;

    const data = await this.callLinear<{
      issue?: {
        labels?: { nodes?: Array<{ id: string; name: string }> };
        team?: { id: string; labels?: { nodes?: Array<{ id: string; name: string }> } };
      };
    }>(issueQuery, { id: issueId }, 'linear_issue_team_query');

    // Bail early if the issue already carries this label.
    const currentLabels = data.issue?.labels?.nodes ?? [];
    if (currentLabels.some((l) => l.name.toLowerCase() === labelName.toLowerCase())) {
      return;
    }

    // Look for an existing team-level label with the requested name.
    const teamLabels = data.issue?.team?.labels?.nodes ?? [];
    let labelId = teamLabels.find((l) => l.name.toLowerCase() === labelName.toLowerCase())?.id;

    // If the label doesn't exist on the team yet, create it.
    if (!labelId) {
      const teamId = data.issue?.team?.id;
      if (!teamId) {
        logger.warn({ action: 'linear_label_create', issueId, labelName }, 'Cannot create label: team ID not resolved');
        return;
      }

      const createMutation = `
        mutation CreateIssueLabel($input: IssueLabelCreateInput!) {
          issueLabelCreate(input: $input) {
            issueLabel { id }
          }
        }
      `;

      const createData = await this.callLinear<{
        issueLabelCreate?: { issueLabel?: { id: string } };
      }>(createMutation, { input: { name: labelName, teamId } }, 'linear_label_create');

      labelId = createData.issueLabelCreate?.issueLabel?.id;
      if (!labelId) {
        logger.warn({ action: 'linear_label_create', issueId, labelName }, 'issueLabelCreate returned no ID');
        return;
      }
    }

    // Attach the label to the issue using issueAddLabel.
    const addMutation = `
      mutation AddLabelToIssue($id: String!, $labelId: String!) {
        issueAddLabel(id: $id, labelId: $labelId) {
          success
        }
      }
    `;

    await this.callLinear(addMutation, { id: issueId, labelId }, 'linear_issue_add_label');
  }

  private async callLinear<TData = unknown>(
    query: string,
    variables: Record<string, unknown>,
    action: string,
  ): Promise<TData> {
    const startedAt = Date.now();
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      throw new Error(`Linear API ${action} failed with status ${response.status} (${durationMs}ms)`);
    }

    const payload = (await response.json()) as { data?: TData; errors?: Array<{ message?: string }> };
    if (payload.errors?.length) {
      throw new Error(
        `Linear API ${action} returned GraphQL errors: ${payload.errors.map((e) => e.message ?? 'unknown').join('; ')}`,
      );
    }

    logger.info(
      {
        timestamp: new Date().toISOString(),
        action,
        status: 'success',
        metadata: { durationMs },
      },
      'Linear write call completed',
    );

    return (payload.data ?? {}) as TData;
  }
}

export interface SyncPrOpenedInput {
  eventId: string;
  issueId: string;
  issueIdentifier: string;
  owner: string;
  repo: string;
  prNumber: number;
  prUrl?: string;
}

export class LinearSyncService {
  constructor(
    private readonly client: LinearWriteClient,
    private readonly dryRun = true,
  ) { }

  async syncPrOpened(input: SyncPrOpenedInput): Promise<void> {
    const commentBody = `PR #${input.prNumber} opened: ${input.prUrl ?? 'URL unavailable'}`;

    if (this.dryRun) {
      logger.info(
        {
          timestamp: new Date().toISOString(),
          eventId: input.eventId,
          action: 'linear_sync_pr_opened',
          status: 'dry_run',
          metadata: {
            issueIdentifier: input.issueIdentifier,
            owner: input.owner,
            repo: input.repo,
            prNumber: input.prNumber,
            commentBody,
            label: 'GitHub PR',
          },
        },
        'Dry-run enabled: skipped Linear write actions',
      );
      return;
    }

    await this.client.addComment(input.issueId, commentBody);
    await this.client.addLabel(input.issueId, 'GitHub PR');

    logger.info(
      {
        timestamp: new Date().toISOString(),
        eventId: input.eventId,
        action: 'linear_sync_pr_opened',
        status: 'synced',
        metadata: {
          issueIdentifier: input.issueIdentifier,
          owner: input.owner,
          repo: input.repo,
          prNumber: input.prNumber,
        },
      },
      'Read-only Linear sync actions completed',
    );
  }
}
