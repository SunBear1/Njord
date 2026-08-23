-- Migration 0003: add 'stock' as a valid holdings.asset_class
-- Applied automatically by Terraform (infrastructure/db.tf, null_resource.auth_db_schema)
-- on every `terraform apply`. SQLite/D1 cannot alter a CHECK constraint in place, so this
-- rebuilds the table with the widened constraint.

BEGIN TRANSACTION;

CREATE TABLE holdings_new (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_class  TEXT NOT NULL CHECK (asset_class IN ('bond', 'savings', 'stock')),
  source       TEXT,
  data         TEXT NOT NULL,
  added_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO holdings_new (id, user_id, asset_class, source, data, added_at, updated_at)
SELECT id, user_id, asset_class, source, data, added_at, updated_at FROM holdings;

DROP TABLE holdings;

ALTER TABLE holdings_new RENAME TO holdings;

CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);

COMMIT;
