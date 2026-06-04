// Package cache implements the Postgres-backed cache used by HTTP handlers
// to memoize upstream API responses (Yahoo Finance, NBP, etc.) under a
// (provider, key) tuple with a configurable TTL.
package cache

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrMiss is returned by Get when (provider, key) is absent or expired.
var ErrMiss = errors.New("cache miss")

// Cache wraps the `cache` Postgres table.
type Cache struct {
	pool *pgxpool.Pool
}

// New wraps an existing pgxpool.Pool.
func New(pool *pgxpool.Pool) *Cache {
	return &Cache{pool: pool}
}

// Init creates the `cache` table if it does not already exist.
func (c *Cache) Init(ctx context.Context) error {
	const ddl = `
CREATE TABLE IF NOT EXISTS cache (
    provider    TEXT        NOT NULL,
    key         TEXT        NOT NULL,
    value_json  JSONB       NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (provider, key)
);
CREATE INDEX IF NOT EXISTS cache_expires_at_idx ON cache (expires_at);
`
	if _, err := c.pool.Exec(ctx, ddl); err != nil {
		return fmt.Errorf("init cache schema: %w", err)
	}
	return nil
}

// Get returns the cached payload for (provider, key) or ErrMiss if absent
// or expired.
func (c *Cache) Get(ctx context.Context, provider, key string) ([]byte, error) {
	var payload []byte
	err := c.pool.QueryRow(ctx, `
SELECT value_json
  FROM cache
 WHERE provider = $1
   AND key = $2
   AND expires_at > NOW()
`, provider, key).Scan(&payload)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrMiss
	}
	if err != nil {
		return nil, fmt.Errorf("cache get: %w", err)
	}
	return payload, nil
}

// Set upserts (provider, key) → payload with the given TTL.
func (c *Cache) Set(ctx context.Context, provider, key string, payload []byte, ttl time.Duration) error {
	if ttl <= 0 {
		return errors.New("cache: ttl must be positive")
	}
	_, err := c.pool.Exec(ctx, `
INSERT INTO cache (provider, key, value_json, expires_at)
VALUES ($1, $2, $3::jsonb, NOW() + $4::interval)
ON CONFLICT (provider, key)
DO UPDATE SET value_json = EXCLUDED.value_json,
              expires_at = EXCLUDED.expires_at
`, provider, key, string(payload), ttl.String())
	if err != nil {
		return fmt.Errorf("cache set: %w", err)
	}
	return nil
}
