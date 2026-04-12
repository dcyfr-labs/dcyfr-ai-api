-- Linear ↔ GitHub issue mapping store schema (Phase 2)

CREATE TABLE IF NOT EXISTS issue_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  linear_issue_id TEXT NOT NULL,
  linear_identifier TEXT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  pr_url TEXT,
  source TEXT NOT NULL DEFAULT 'branch',
  confidence INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_sync_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (linear_issue_id, owner, repo, pr_number)
);

CREATE INDEX IF NOT EXISTS issue_mappings_linear_identifier_idx
  ON issue_mappings(linear_identifier);

CREATE INDEX IF NOT EXISTS issue_mappings_repo_pr_idx
  ON issue_mappings(owner, repo, pr_number);

CREATE INDEX IF NOT EXISTS issue_mappings_created_at_idx
  ON issue_mappings(created_at DESC);
