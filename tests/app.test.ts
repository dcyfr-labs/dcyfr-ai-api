/**
 * Integration tests for app-level middleware paths that are wired in src/app.ts:
 *   - CORS allow / block on no-origin / allowlisted / non-allowlisted requests
 *   - GET /metrics (Prometheus scrape endpoint)
 *
 * CORS_ORIGIN defaults to 'http://localhost:3000' when unset (see src/config).
 * tests/setup.ts imports db/connection which transitively loads config before
 * any per-file env mutations can take effect, so we test against that default.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const ALLOWED_ORIGIN = 'http://localhost:3000';

describe('CORS middleware', () => {
  it('allows a request with no Origin header (server-to-server, mobile)', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('allows an allowlisted origin and reflects it in Access-Control-Allow-Origin', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/health')
      .set('Origin', ALLOWED_ORIGIN);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('blocks a non-allowlisted origin (no ACAO header on response)', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example');
    // The cors middleware throws "Not allowed by CORS" on disallowed origins;
    // express returns 500 by default but the key signal is the missing ACAO.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('GET /metrics', () => {
  it('returns Prometheus-formatted metrics with the expected content-type', async () => {
    const app = createApp();
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    // Default prom-client output starts with HELP / TYPE comment lines
    expect(res.text).toMatch(/# HELP/);
    expect(res.text).toMatch(/# TYPE/);
  });
});
