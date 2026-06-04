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

	"github.com/SunBear1/Njord/backend/internal/auth"
	"github.com/SunBear1/Njord/backend/internal/cache"
	"github.com/SunBear1/Njord/backend/internal/finance"
	"github.com/SunBear1/Njord/backend/internal/seed"
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

// readyzHandler checks whether the backend can serve traffic. Unlike
// healthHandler (liveness), it verifies DB connectivity so that the pod
// is removed from Service endpoints while the database is unreachable,
// rather than being restarted unnecessarily.
func readyzHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if pool != nil {
			if err := pool.Ping(r.Context()); err != nil {
				http.Error(w, "db unreachable", http.StatusServiceUnavailable)
				return
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(healthResponse{Status: "ok", Version: version})
	}
}

// serverDeps groups optional collaborators wired by main.
type serverDeps struct {
	cache     finance.Cacher
	pool      *pgxpool.Pool
	client    *http.Client
	nbp       *finance.NBPClient
	jwtSecret string
}

func newServer(addr string, deps serverDeps) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", healthHandler)
	mux.HandleFunc("GET /api/v1/readyz", readyzHandler(deps.pool))

	client := deps.client
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}

	if deps.cache != nil {
		mux.HandleFunc("GET /api/v1/finance/stocks/{ticker}",
			finance.StocksHandler(deps.cache, client, finance.YahooBaseDefault))
	}
	if deps.pool != nil {
		mux.HandleFunc("GET /api/v1/finance/bonds",
			finance.BondsHandler(deps.pool))
		mux.HandleFunc("GET /api/v1/finance/inflation",
			finance.InflationHandler(deps.pool, deps.cache, client))
		mux.HandleFunc("GET /api/v1/finance/inflation/forecast",
			finance.InflationForecastHandler(deps.pool))
	}
	if deps.pool != nil && deps.jwtSecret != "" {
		auth.NewHandlers(deps.pool, deps.jwtSecret).Register(mux)
	}
	if deps.nbp != nil {
		mux.HandleFunc("GET /api/v1/finance/currency",
			finance.CurrencyHandler(deps.nbp))
		if deps.cache != nil {
			mux.HandleFunc("GET /api/v1/finance/currency/rate",
				finance.CurrencyRateHandler(deps.nbp, deps.cache))
			mux.HandleFunc("GET /api/v1/finance/currency/history",
				finance.CurrencyHistoryHandler(deps.nbp, deps.cache))
		}
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
	deps.nbp = finance.NewNBPClient(deps.client, "", "")

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
		if err := seed.Apply(ctx, pool); err != nil {
			slog.Error("seed apply", "err", err)
			os.Exit(1)
		}
		if err := auth.ApplySchema(ctx, pool); err != nil {
			slog.Error("auth schema", "err", err)
			os.Exit(1)
		}
		deps.cache = c
		deps.pool = pool
		slog.Info("postgres cache + seed ready")
	}

	if secret := os.Getenv("JWT_SECRET"); secret != "" {
		deps.jwtSecret = secret
	} else if deps.pool != nil {
		slog.Error("JWT_SECRET is required when DATABASE_URL is set")
		os.Exit(1)
	}
	if deps.pool == nil {
		slog.Warn("DATABASE_URL not set — finance + auth endpoints disabled")
	}

	srv := newServer(addr, deps)
	slog.Info("njord-backend starting", "addr", addr, "version", version)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("server terminated", "err", err)
		os.Exit(1)
	}
}
