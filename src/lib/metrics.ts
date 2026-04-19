/**
 * Prometheus metrics registry for @dcyfr/ai-api.
 *
 * One process-wide default registry holds all counters / gauges. Route
 * handlers import the specific metric they need and call `.inc()` / `.set()`
 * on it; scraping happens via the `/metrics` route in `app.ts`.
 *
 * Keep this module thin — each new metric is a small, well-documented
 * object with explicit label cardinality. Cardinality explosions kill
 * Prometheus storage, so every new label value must be bounded in advance.
 */
import { Counter, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();

// Default Node.js process/runtime metrics (cpu, mem, event loop, gc).
// Scoped to our registry so they don't leak into any other prom-client
// instance that might exist in node_modules.
collectDefaultMetrics({ register: registry, prefix: 'dcyfr_api_' });

/**
 * funnel_webhook_requests_total
 *
 * Counts inbound requests to any endpoint that's publicly exposed via
 * Tailscale Funnel. Right now that's exactly one path:
 *   POST /api/linear-sync/github-webhook
 *
 * The `result` label is bounded to the handler's exit states so cardinality
 * is O(1). If a new Funnel path is added, instrument it with the same
 * counter + a `route` label (don't fork a new metric — Funnel-wide
 * aggregation on "requests_total" is the whole point).
 *
 * Label set:
 *   route:  'linear_github_webhook'  (more routes as needed)
 *   result: 'accepted' | 'rate_limited' | 'invalid_signature' |
 *           'unsupported_event' | 'unsupported_action' |
 *           'missing_metadata' | 'missing_secret'
 *
 * Partner dashboard: workbench-secure-leverage Phase 6.1 "Tailscale &
 * Funnel" dashboard. Alert rules in Phase 6.2: burst of non-'accepted'
 * results ⇒ Funnel being probed / misconfigured.
 */
export const funnelWebhookRequests = new Counter({
  name: 'funnel_webhook_requests_total',
  help: 'Count of inbound Funnel-exposed webhook requests by route and result state.',
  labelNames: ['route', 'result'] as const,
  registers: [registry],
});

/**
 * Valid values for the funnelWebhookRequests `result` label. Exporting the
 * type so route handlers get a compile-time error if they drift.
 */
export type FunnelWebhookResult =
  | 'accepted'
  | 'rate_limited'
  | 'invalid_signature'
  | 'unsupported_event'
  | 'unsupported_action'
  | 'missing_metadata'
  | 'missing_secret';
