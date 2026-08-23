-- Migration 0002: multi-asset holdings (bonds, savings accounts)
-- Apply with: wrangler d1 execute AUTH_DB --file=migrations/0002_create_holdings.sql

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
