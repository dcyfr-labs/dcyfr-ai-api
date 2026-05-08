/**
 * Loader and applier for per-repo .dcyfr/reviewer.json configuration.
 * Fetches from GitHub Contents API; falls back to defaults when absent.
 * Pure parsing/filtering functions are exported for testability.
 */
import { logger } from '../../lib/logger.js';
import { type ReviewComment } from './github-review-service.js';

const GITHUB_OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const GITHUB_REPO_RE = /^[A-Za-z0-9_.-]{1,100}$/;

export interface ReviewerConfig {
  /** Minimum severity to report. Findings below this level are suppressed. */
  severityThreshold: ReviewComment['severity'];
  /** Glob-style path patterns for files to skip entirely. */
  skipPatterns: string[];
  /** Rule IDs to suppress (e.g. "insecure-random", "xss-dangerous-html"). */
  skipRules: string[];
}

const DEFAULTS: ReviewerConfig = {
  severityThreshold: 'info',
  skipPatterns: [],
  skipRules: [],
};

const SEVERITY_RANK: Record<ReviewComment['severity'], number> = {
  error: 2,
  warning: 1,
  info: 0,
};

/**
 * Parse and validate a raw JSON value into a ReviewerConfig, merging with
 * defaults for missing or invalid fields. Never throws.
 */
export function parseReviewerConfig(raw: unknown): ReviewerConfig {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULTS };

  const obj = raw as Record<string, unknown>;
  const validThresholds: ReviewComment['severity'][] = ['error', 'warning', 'info'];

  const severityThreshold =
    validThresholds.includes(obj['severityThreshold'] as ReviewComment['severity'])
      ? (obj['severityThreshold'] as ReviewComment['severity'])
      : DEFAULTS.severityThreshold;

  const skipPatterns = Array.isArray(obj['skipPatterns'])
    ? obj['skipPatterns'].filter((p): p is string => typeof p === 'string')
    : DEFAULTS.skipPatterns;

  const skipRules = Array.isArray(obj['skipRules'])
    ? obj['skipRules'].filter((r): r is string => typeof r === 'string')
    : DEFAULTS.skipRules;

  return { severityThreshold, skipPatterns, skipRules };
}

/**
 * Convert a simple glob pattern (*, **, ?) to a RegExp.
 * Supports: `*.ts`, `**\/*.test.ts`, `src\/**`, `?oo.ts`.
 */
function globToRegex(pattern: string): RegExp {
  // Sentinel for `**` so the next pass that substitutes single `*` doesn't
  // re-match it. A NUL byte was the prior choice but SonarCloud's
  // "Remove control character" rule rejects it; this string token works
  // identically and is unlikely to collide with any real glob input.
  const DOUBLESTAR_SENTINEL = '__GLOB_DOUBLE_STAR__';
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, DOUBLESTAR_SENTINEL)
    .replace(/\*/g, '[^/]*')
    .replace(new RegExp(DOUBLESTAR_SENTINEL, 'g'), '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`(^|/)${escaped}$`);
}

/** Returns true if the file path matches any of the skip glob patterns. */
export function shouldSkipFile(filename: string, patterns: string[]): boolean {
  return patterns.some((p) => globToRegex(p).test(filename));
}

/**
 * Filter a comment list using the loaded config:
 * - Remove comments whose severity is below the threshold.
 * - Remove comments whose ruleId is in skipRules.
 */
export function applyConfig(
  comments: ReviewComment[],
  config: ReviewerConfig,
): ReviewComment[] {
  const minRank = SEVERITY_RANK[config.severityThreshold];
  const skipSet = new Set(config.skipRules);

  return comments.filter((c) => {
    if (SEVERITY_RANK[c.severity] < minRank) return false;
    if (c.ruleId !== undefined && skipSet.has(c.ruleId)) return false;
    return true;
  });
}

interface GitHubContentsResponse {
  content?: string;
  encoding?: string;
}

/**
 * Fetch .dcyfr/reviewer.json from the target repo via GitHub Contents API.
 * Returns defaults when the file is absent (404) or unparseable.
 */
export async function fetchReviewerConfig(
  owner: string,
  repo: string,
  token: string,
): Promise<ReviewerConfig> {
  if (!GITHUB_OWNER_RE.test(owner) || !GITHUB_REPO_RE.test(repo)) {
    logger.warn({ owner, repo }, 'reviewer-config: invalid owner/repo slug, using defaults');
    return { ...DEFAULTS };
  }
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/.dcyfr/reviewer.json`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch (err) {
    logger.warn({ owner, repo, err }, 'reviewer-config: fetch failed, using defaults');
    return { ...DEFAULTS };
  }

  if (response.status === 404) {
    return { ...DEFAULTS };
  }

  if (!response.ok) {
    logger.warn(
      { owner, repo, status: response.status },
      'reviewer-config: unexpected GitHub API status, using defaults',
    );
    return { ...DEFAULTS };
  }

  let body: GitHubContentsResponse;
  try {
    body = (await response.json()) as GitHubContentsResponse;
  } catch {
    logger.warn({ owner, repo }, 'reviewer-config: failed to parse API response, using defaults');
    return { ...DEFAULTS };
  }

  if (body.encoding !== 'base64' || typeof body.content !== 'string') {
    return { ...DEFAULTS };
  }

  let raw: unknown;
  try {
    const decoded = Buffer.from(body.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    raw = JSON.parse(decoded) as unknown;
  } catch {
    logger.warn({ owner, repo }, 'reviewer-config: invalid JSON in .dcyfr/reviewer.json, using defaults');
    return { ...DEFAULTS };
  }

  const config = parseReviewerConfig(raw);
  logger.info({ owner, repo, config }, 'reviewer-config: loaded from repo');
  return config;
}
