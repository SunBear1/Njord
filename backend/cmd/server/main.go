// Package main starts the Njord backend HTTP server.
//
// Story 0.2 scaffold: only /api/v1/health is implemented. Real API endpoints
// (finance, auth, portfolio) are ported from functions/ in Stories 0.6–0.8.
package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"time"
)

const defaultAddr = ":8080"

// version is exposed via /api/v1/health. Defaults to "dev"; production
// container builds inject the git short SHA via ldflags or NJORD_VERSION env.
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

func newServer(addr string) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", healthHandler)
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

	srv := newServer(addr)
	slog.Info("njord-backend starting", "addr", addr, "version", version)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("server terminated", "err", err)
		os.Exit(1)
	}
}
