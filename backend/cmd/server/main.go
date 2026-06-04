// Package main starts the Njord backend HTTP server.
package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SunBear1/Njord/backend/internal/cache"
	"github.com/SunBear1/Njord/backend/internal/finance"
)

const defaultAddr = ":8080"

// version is exposed via /api/v1/health. Defaults to "dev"; production
// container builds inject the git short SHA via NJORD_VERSION env.
var version = "dev"

type healthResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(healthResponse{Status: "ok", Version: version})
}

// serverDeps groups optional collaborators wired by main. newServer accepts
// nils for tests that only exercise routes that don't need them (health).
type serverDeps struct {
	cache  finance.Cacher
	client *http.Client
}

func newServer(addr string, deps serverDeps) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", healthHandler)

	if deps.cache != nil {
		client := deps.client
		if client == nil {
			client = &http.Client{Timeout: 15 * time.Second}
		}
		mux.HandleFunc("GET /api/v1/finance/stocks/{ticker}",
			finance.StocksHandler(deps.cache, client, finance.YahooBaseDefault))
	}

	return &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	if v := os.Getenv("NJORD_VERSION"); v != "" {
		version = v
	}
	addr := os.Getenv("NJORD_BACKEND_ADDR")
	if addr == "" {
		addr = defaultAddr
	}

	deps := serverDeps{client: &http.Client{Timeout: 15 * time.Second}}

	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		pool, err := pgxpool.New(ctx, dsn)
		if err != nil {
			slog.Error("postgres connect", "err", err)
			os.Exit(1)
		}
		c := cache.New(pool)
		if err := c.Init(ctx); err != nil {
			slog.Error("cache init", "err", err)
			os.Exit(1)
		}
		deps.cache = c
		slog.Info("postgres cache ready")
	} else {
		slog.Warn("DATABASE_URL not set — finance endpoints disabled")
	}

	srv := newServer(addr, deps)
	slog.Info("njord-backend starting", "addr", addr, "version", version)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("server terminated", "err", err)
		os.Exit(1)
	}
}
