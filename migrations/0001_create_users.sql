-- Migration 0001: Create authentication tables
-- Applied automatically by Terraform (infrastructure/db.tf, null_resource.auth_db_schema)
-- on every `terraform apply`.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  avatar_url TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  provider_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_accounts(provider, provider_user_id);
