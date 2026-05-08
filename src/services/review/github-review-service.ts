/**
 * Posts PR review comments to GitHub via REST API.
 * Respects DRY_RUN env var — logs but does not call GitHub when enabled.
 */
import { logger } from '../../lib/logger.js';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const GITHUB_REPO_RE = /^[A-Za-z0-9_.-]{1,100}$/;

/**
 * Build a GitHub API URL from a validated owner/repo + path. Throws on bad
 * slug. Constructs via `new URL(path, base)` so the host is bound to the
 * literal `api.github.com` — CodeQL recognises this pattern as a SSRF
 * sanitiser since no caller-controlled value can change the host.
 */
function buildGhUrl(owner: string, repo: string, suffix: string): string {
  if (!GITHUB_OWNER_RE.test(owner) || !GITHUB_REPO_RE.test(repo)) {
    throw new Error('Invalid GitHub owner/repo slug');
  }
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${suffix}`;
  return new URL(path, GITHUB_API_BASE).toString();
}

export interface ReviewComment {
  path: string;
  line: number;
  body: string;
  severity: 'error' | 'warning' | 'info';
  /** Rule ID that produced this comment, used for config-based suppression. */
  ruleId?: string;
}

interface GitHubPullRequestReviewCommentPayload {
  body: string;
  commit_id: string;
  path: string;
  line: number;
  side: 'RIGHT';
}

function buildCommentBody(comment: ReviewComment): string {
  const badge = comment.severity === 'error' ? '🔴' : comment.severity === 'warning' ? '🟡' : 'ℹ️';
  return `${badge} **[${comment.severity.toUpperCase()}]** ${comment.body}\n\n_Reviewed by DCYFR AI Code Reviewer_`;
}

async function getHeadCommitSha(owner: string, repo: string, prNumber: number, token: string): Promise<string> {
  const url = buildGhUrl(owner, repo, `/pulls/${prNumber}`);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error fetching PR (${response.status})`);
  }

  const pr = await response.json() as { head: { sha: string } };
  return pr.head.sha;
}

async function postSingleComment(
  owner: string,
  repo: string,
  prNumber: number,
  comment: ReviewComment,
  commitSha: string,
  token: string,
): Promise<void> {
  const url = buildGhUrl(owner, repo, `/pulls/${prNumber}/comments`);
  const payload: GitHubPullRequestReviewCommentPayload = {
    body: buildCommentBody(comment),
    commit_id: commitSha,
    path: comment.path,
    line: comment.line,
    side: 'RIGHT',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error posting comment (${response.status}): ${text}`);
  }
}

export async function fetchPullRequestDiff(
  owner: string,
  repo: string,
  prNumber: number,
  token: string,
): Promise<string> {
  const url = buildGhUrl(owner, repo, `/pulls/${prNumber}`);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.diff',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error fetching PR diff (${response.status})`);
  }

  return response.text();
}

export async function postReviewComments(
  owner: string,
  repo: string,
  prNumber: number,
  comments: ReviewComment[],
  token: string,
): Promise<void> {
  const dryRun = process.env.DRY_RUN?.toLowerCase() !== 'false';

  if (comments.length === 0) {
    logger.info({ owner, repo, prNumber }, 'No review comments to post');
    return;
  }

  if (dryRun) {
    logger.info({ owner, repo, prNumber, commentCount: comments.length }, 'DRY_RUN: skipping GitHub review comment post');
    for (const c of comments) {
      logger.info({ path: c.path, line: c.line, severity: c.severity, body: c.body }, 'DRY_RUN comment');
    }
    return;
  }

  const commitSha = await getHeadCommitSha(owner, repo, prNumber, token);

  let posted = 0;
  let failed = 0;

  for (const comment of comments) {
    try {
      await postSingleComment(owner, repo, prNumber, comment, commitSha, token);
      posted++;
    } catch (err) {
      failed++;
      logger.error({ path: comment.path, line: comment.line, err }, 'Failed to post review comment');
    }
  }

  logger.info({ owner, repo, prNumber, posted, failed }, 'Review comments posted');
}
