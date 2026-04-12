#!/usr/bin/env node
/**
 * Register GitHub pull_request webhook for Linear sync pilot.
 *
 * Required env vars:
 * - GITHUB_TOKEN
 * - GITHUB_OWNER (e.g. dcyfr)
 * - GITHUB_REPO (e.g. dcyfr-ai)
 * - WEBHOOK_URL (public endpoint to /api/linear-sync/github-webhook)
 * - GITHUB_WEBHOOK_SECRET
 *
 * Optional:
 * - WEBHOOK_EVENTS (comma-separated, default: pull_request)
 * - DRY_RUN (default: true)
 */

const {
  GITHUB_TOKEN,
  GITHUB_OWNER,
  GITHUB_REPO,
  WEBHOOK_URL,
  GITHUB_WEBHOOK_SECRET,
  WEBHOOK_EVENTS = 'pull_request',
  DRY_RUN = 'true',
} = process.env;

function required(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

function buildPayload() {
  const events = WEBHOOK_EVENTS.split(',').map((e) => e.trim()).filter(Boolean);

  return {
    name: 'web',
    active: true,
    events,
    config: {
      url: WEBHOOK_URL,
      content_type: 'json',
      secret: GITHUB_WEBHOOK_SECRET,
      insecure_ssl: '0',
    },
  };
}

async function createWebhook(payload) {
  const endpoint = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/hooks`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function main() {
  required('GITHUB_TOKEN', GITHUB_TOKEN);
  required('GITHUB_OWNER', GITHUB_OWNER);
  required('GITHUB_REPO', GITHUB_REPO);
  required('WEBHOOK_URL', WEBHOOK_URL);
  required('GITHUB_WEBHOOK_SECRET', GITHUB_WEBHOOK_SECRET);

  const payload = buildPayload();
  const dryRun = DRY_RUN.toLowerCase() !== 'false';

  console.log('[setup-linear-github-webhook] Target repo:', `${GITHUB_OWNER}/${GITHUB_REPO}`);
  console.log('[setup-linear-github-webhook] Endpoint:', WEBHOOK_URL);
  console.log('[setup-linear-github-webhook] Events:', payload.events.join(', '));

  if (dryRun) {
    console.log('[setup-linear-github-webhook] DRY_RUN=true, no webhook created.');
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const created = await createWebhook(payload);
  console.log('[setup-linear-github-webhook] Webhook created successfully');
  console.log(JSON.stringify({ id: created.id, url: created.config?.url, events: created.events }, null, 2));
}

main().catch((error) => {
  console.error('[setup-linear-github-webhook] Error:', error.message);
  process.exit(1);
});
