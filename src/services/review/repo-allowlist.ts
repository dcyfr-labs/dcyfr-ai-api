/**
 * Repo allowlist for the GitHub PR review service.
 *
 * Closes CodeQL js/request-forgery — owner/repo arrives from webhook payloads
 * (user-controlled). Without an allowlist, an attacker installing the webhook
 * on their own repo can get this service to fetch + post comments using our
 * GitHub token.
 *
 * Reject before any fetch. The allowlist is sourced from
 * config.reviewAllowedRepos (env: REVIEW_ALLOWED_REPOS).
 *
 * Allowlist entries:
 *   - exact pair      "dcyfr-labs/dcyfr-labs"  → permits only that repo
 *   - owner wildcard  "dcyfr-labs/*"           → permits any repo under owner
 */
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

let warnedEmpty = false;

/**
 * Returns true iff (owner, repo) is permitted by the allowlist.
 * Empty allowlist behaviour:
 *   - production: deny all (return false)
 *   - dev/test:   permit all (return true) with a one-time warning
 */
export function isRepoAllowed(owner: string, repo: string): boolean {
  // Defense-in-depth: reject obviously-malformed identifiers regardless of
  // allowlist state. GitHub repo names are restricted to [A-Za-z0-9._-].
  if (!isValidIdentifier(owner) || !isValidIdentifier(repo)) {
    return false;
  }

  const allowlist = config.reviewAllowedRepos;
  if (allowlist.length === 0) {
    if (config.env === 'production') {
      return false;
    }
    if (!warnedEmpty) {
      warnedEmpty = true;
      logger.warn(
        '⚠️  REVIEW_ALLOWED_REPOS is empty. In dev mode this permits all repos; ' +
          'set the env var before deploying to production or webhooks will be rejected.',
      );
    }
    return true;
  }

  const target = `${owner}/${repo}`;
  for (const entry of allowlist) {
    if (entry === target) return true;
    if (entry.endsWith('/*') && entry.slice(0, -2) === owner) return true;
  }
  return false;
}

function isValidIdentifier(s: string): boolean {
  // GitHub login/repo names: alphanumerics, hyphens, periods, underscores.
  // Reject anything that could change the URL shape.
  return /^[A-Za-z0-9._-]+$/.test(s);
}
