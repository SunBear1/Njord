//go:build integration

package cache

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TestCacheRoundtrip runs against a live Postgres pointed at by DATABASE_URL.
// Gate with `go test -tags=integration ./internal/cache/...`.
func TestCacheRoundtrip(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	c := New(pool)
	if err := c.Init(ctx); err != nil {
		t.Fatalf("init: %v", err)
	}

	// Clean slate for this test key.
	_, _ = pool.Exec(ctx, `DELETE FROM cache WHERE provider='test' AND key='roundtrip'`)

	if _, err := c.Get(ctx, "test", "roundtrip"); err == nil {
		t.Fatal("expected miss on empty key")
	}

	payload := []byte(`{"hello":"world"}`)
	if err := c.Set(ctx, "test", "roundtrip", payload, 5*time.Second); err != nil {
		t.Fatalf("set: %v", err)
	}

	got, err := c.Get(ctx, "test", "roundtrip")
	if err != nil {
		t.Fatalf("get after set: %v", err)
	}
	if string(got) != string(payload) {
		t.Errorf("got %s, want %s", got, payload)
	}

	// Expiry: set a 1ms entry then sleep.
	if err := c.Set(ctx, "test", "roundtrip", payload, time.Millisecond); err != nil {
		t.Fatalf("set ttl: %v", err)
	}
	time.Sleep(50 * time.Millisecond)
	if _, err := c.Get(ctx, "test", "roundtrip"); err == nil {
		t.Error("expected miss on expired entry")
	}
}
