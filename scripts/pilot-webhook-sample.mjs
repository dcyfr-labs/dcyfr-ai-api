#!/usr/bin/env node
/**
 * Pilot webhook sample sender — Linear Phase 2 KPI capture
 *
 * Sends 12 synthetic pull_request events to the local webhook endpoint,
 * covering all correlation source types and edge cases.
 *
 * Usage:
 *   WEBHOOK_SECRET=<secret> node scripts/pilot-webhook-sample.mjs [endpoint]
 */

import crypto from 'node:crypto';

const ENDPOINT = process.argv[2] ?? 'http://localhost:3001/api/linear-sync/github-webhook';
const SECRET = process.env.WEBHOOK_SECRET ?? process.env.GITHUB_WEBHOOK_SECRET;

if (!SECRET) {
  console.error('ERROR: set WEBHOOK_SECRET env var');
  process.exit(1);
}

function sign(payload) {
  return 'sha256=' + crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

async function _sendEvent(payload, label) {
  const body = JSON.stringify(payload);
  const signature = sign(body);
  const eventId = crypto.randomUUID();

  const start = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': eventId,
    },
    body,
  });
  const latencyMs = Date.now() - start;

  const responseText = await res.text().catch(() => '');
  console.log(
    `[${res.status}] ${latencyMs}ms | ${label} | delivery=${eventId.slice(0, 8)}... | resp=${responseText.slice(0, 80)}`,
  );

  return { status: res.status, latencyMs, label, eventId };
}

// ── Test matrix ──────────────────────────────────────────────────────────────

const CASES = [
  // branch-based extraction (highest confidence)
  {
    label: 'branch:DCYFR-101 (opened)',
    payload: pr('feature/DCYFR-101-add-webhook-ingest', 'Add webhook ingest', null, 'dcyfr', 'dcyfr-ai', 101, 'opened'),
  },
  {
    label: 'branch:DCYFR-202 (synchronize)',
    payload: pr('fix/DCYFR-202-signature-validation', 'Fix signature validation', null, 'dcyfr', 'dcyfr-ai', 202, 'synchronize'),
  },
  {
    label: 'branch:DCYFR-303 (reopened)',
    payload: pr('chore/DCYFR-303-cleanup', 'Minor cleanup', null, 'dcyfr', 'dcyfr-ai', 303, 'reopened'),
  },
  // title-based extraction (second priority)
  {
    label: 'title:DCYFR-404 (no key in branch)',
    payload: pr('feature/new-feature', '[DCYFR-404] Add new feature', null, 'dcyfr', 'dcyfr-ai', 404, 'opened'),
  },
  {
    label: 'title:DCYFR-505 (no key in branch)',
    payload: pr('bugfix/some-fix', 'DCYFR-505 Fix crash on startup', null, 'dcyfr', 'dcyfr-ai', 505, 'opened'),
  },
  // body-based extraction (fallback)
  {
    label: 'body:DCYFR-606 (no key in branch/title)',
    payload: pr('feature/unkeyed', 'Some feature', 'Fixes DCYFR-606 as requested in Linear', 'dcyfr', 'dcyfr-ai', 606, 'opened'),
  },
  // no identifier (should return no_identifier)
  {
    label: 'no-key (no issue key anywhere)',
    payload: pr('feature/unkeyed-branch', 'Add something new', null, 'dcyfr', 'dcyfr-ai', 700, 'opened'),
  },
  // different repos
  {
    label: 'branch:DCYFR-801 (dcyfr-ai-api repo)',
    payload: pr('feat/DCYFR-801-api-route', 'Add API route', null, 'dcyfr', 'dcyfr-ai-api', 801, 'opened'),
  },
  {
    label: 'branch:DCYFR-901 (dcyfr-labs repo)',
    payload: pr('feat/DCYFR-901-ui-component', 'New UI component', null, 'dcyfr', 'dcyfr-labs', 901, 'opened'),
  },
  // duplicate/re-open (idempotency test)
  {
    label: 'branch:DCYFR-101 (synchronize - same issue)',
    payload: pr('feature/DCYFR-101-add-webhook-ingest', 'Add webhook ingest', null, 'dcyfr', 'dcyfr-ai', 101, 'synchronize'),
  },
  // wrong event type (should be skipped)
  {
    label: 'event:issues (should be skipped)',
    payload: pr('feature/DCYFR-999', 'Something', null, 'dcyfr', 'dcyfr-ai', 999, 'opened'),
    overrideEvent: 'issues',
  },
  // invalid signature (should be rejected)
  {
    label: 'invalid-signature (should return 401)',
    payload: pr('feature/DCYFR-123', 'Test', null, 'dcyfr', 'dcyfr-ai', 123, 'opened'),
    overrideSignature: 'sha256=deadbeefdeadbeefdeadbeef',
  },
];

function pr(branch, title, body, org, repo, number, action) {
  return {
    action,
    pull_request: {
      number,
      html_url: `https://github.com/${org}/${repo}/pull/${number}`,
      title,
      body: body ?? null,
      head: { ref: branch },
    },
    repository: {
      name: repo,
      owner: { login: org },
    },
    sender: { login: 'rei-bot' },
  };
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function runPilot() {
  console.log(`\nPilot sample: ${CASES.length} events → ${ENDPOINT}\n`);
  const results = [];

  for (const { label, payload, overrideEvent, overrideSignature } of CASES) {
    const body = JSON.stringify(payload);
    const signature = overrideSignature ?? sign(body);
    const eventId = crypto.randomUUID();
    const event = overrideEvent ?? 'pull_request';

    const start = Date.now();
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature,
        'x-github-event': event,
        'x-github-delivery': eventId,
      },
      body,
    });
    const latencyMs = Date.now() - start;
    const _responseText = await res.text().catch(() => '');

    const row = { status: res.status, latencyMs, label, eventId: eventId.slice(0, 8) };
    results.push(row);
    console.log(`[${res.status}] ${String(latencyMs).padStart(4)}ms | ${label}`);

    // Brief pause between requests
    await new Promise((r) => setTimeout(r, 100));
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const accepted = results.filter((r) => r.status === 202).length;
  const rejected = results.filter((r) => r.status === 401).length;
  const _skipped = results.filter((r) => r.status === 202 && r.label.includes('skipped')).length;
  const latencies = results.map((r) => r.latencyMs);
  const p50 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];

  console.log(`
────────────────────────────────────────
Pilot Sample Summary
────────────────────────────────────────
Total events     : ${results.length}
202 Accepted     : ${accepted}
401 Rejected     : ${rejected}
Latency p50      : ${p50}ms
Latency p95      : ${p95}ms
────────────────────────────────────────
`);

  return results;
}

runPilot().catch((err) => {
  console.error(err);
  process.exit(1);
});
