// Package main starts the Njord backend HTTP server.
//
// Story 0.2 scaffold: only /api/v1/health is implemented. Real API endpoints
// (finance, auth, portfolio) are ported from functions/ in Stories 0.6–0.8.
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

const defaultAddr = ":8080"

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
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
	addr := os.Getenv("NJORD_BACKEND_ADDR")
	if addr == "" {
		addr = defaultAddr
	}
	srv := newServer(addr)
	log.Printf("njord-backend listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}
