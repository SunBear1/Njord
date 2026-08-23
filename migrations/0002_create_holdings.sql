-- Migration 0002: multi-asset holdings (bonds, savings accounts)
-- Applied automatically by Terraform (infrastructure/db.tf, null_resource.auth_db_schema)
-- on every `terraform apply`.

CREATE TABLE IF NOT EXISTS holdings (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_class  TEXT NOT NULL CHECK (asset_class IN ('bond', 'savings')),
  source       TEXT,
  data         TEXT NOT NULL,
  added_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);
