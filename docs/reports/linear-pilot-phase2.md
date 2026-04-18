# Linear ↔ GitHub Sync — Phase 2 Pilot Report

**Change:** `linear-github-integration`
**Phase:** 2 — MVP Sync Pilot
**Status:** IN PROGRESS
**Target repo:** `dcyfr/dcyfr-ai`
**Pilot start:** TBD (pending webhook registration)
**Report date:** 2026-04-12

---

## Phase 2 Implementation Checklist

### Completed

- [x] Mapping store schema (`src/db/migrations/001_create_issue_mappings.sql`)
- [x] MappingStore service (`src/services/mapping-store.ts`)
- [x] CorrelationService — branch + title pattern matching (`src/services/correlation-service.ts`)
- [x] GitHub webhook ingest route (`src/routes/linear/github-webhook.ts`)
- [x] LinearSyncService — comment + label write actions, dry-run controls (`src/services/linear-sync-service.ts`)
- [x] Route mounted in app (`src/app.ts`)
- [x] Webhook registration helper script (`scripts/setup-linear-github-webhook.mjs`)
- [x] Test coverage — all linear services and routes passing (163/163)

### Pending (blocking pilot launch)

- [ ] Register webhook on `dcyfr/dcyfr-ai` (requires real `GITHUB_TOKEN` with `admin:repo_hook` + `DRY_RUN=false`)
- [ ] Resolve `LINEAR_API_KEY` from 1Password (`op signin` + `op run --env-file=.env`)
- [ ] Deploy or confirm `api.dcyfr.ai` is serving the ingest endpoint
- [ ] Set `DRY_RUN=false` in production environment

---

## Webhook Registration

```bash
# One-time: register webhook on dcyfr/dcyfr-ai
GITHUB_TOKEN=<pat-with-admin:repo_hook> \
GITHUB_OWNER=dcyfr \
GITHUB_REPO=dcyfr-ai \
WEBHOOK_URL=https://api.dcyfr.ai/api/linear-sync/github-webhook \
GITHUB_WEBHOOK_SECRET=<from-.env> \
DRY_RUN=false \
npm run linear:webhook:setup
```

Dry-run output (validated 2026-04-12):
```json
{
  "name": "web",
  "active": true,
  "events": ["pull_request"],
  "config": {
    "url": "https://api.dcyfr.ai/api/linear-sync/github-webhook",
    "content_type": "json",
    "insecure_ssl": "0"
  }
}
```

---

## KPI Targets (to be validated post-launch)

| KPI | Target | Baseline | Measured |
|---|---|---|---|
| PR → Linear issue correlation rate | ≥ 80% | 0% (manual) | TBD |
| Manual status update volume | ≤ 20% of pre-pilot | ~100% manual | TBD |
| Webhook ingest latency (p95) | < 500ms | N/A | TBD |
| False positive correlations | < 5% | N/A | TBD |
| Sync errors / dropped events | 0 in 7-day window | N/A | TBD |

---

## Pilot Validation Window

- **Duration:** 7 days post-launch
- **Scope:** All PRs opened against `dcyfr/dcyfr-ai` main branch
- **Gate to Phase 3:** All KPI targets met; no P0 incidents in pilot window

---

## Notes

- `DRY_RUN=true` remains the default in `.env` — production must explicitly override
- `LINEAR_API_KEY` resolves via 1Password: `op://CI-CD/Linear/api_key` — requires `op signin` before service start
- Phase 3 begins after this report is marked complete with KPI data
