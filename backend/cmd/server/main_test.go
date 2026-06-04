package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	rec := httptest.NewRecorder()

	healthHandler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("expected Content-Type application/json, got %q", got)
	}

	var body healthResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Status != "ok" {
		t.Fatalf("expected status=ok, got %q", body.Status)
	}
	if body.Version == "" {
		t.Fatalf("expected non-empty version field")
	}
}

func TestServerRoutesHealth(t *testing.T) {
	srv := newServer(":0", serverDeps{})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	rec := httptest.NewRecorder()
	srv.Handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from /api/v1/health, got %d", rec.Code)
	}
}

// TestReadyzHandlerNoPool verifies that /api/v1/readyz returns 200 when no
// database pool is configured (DB-less mode — finance/auth endpoints disabled).
func TestReadyzHandlerNoPool(t *testing.T) {
	handler := readyzHandler(nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/readyz", nil)
	rec := httptest.NewRecorder()
	handler(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 without pool, got %d", rec.Code)
	}
}

// TestServerRoutesReadyz confirms /api/v1/readyz is registered and returns 200
// when no pool is wired (nil pool → no DB check).
func TestServerRoutesReadyz(t *testing.T) {
	srv := newServer(":0", serverDeps{})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/readyz", nil)
	rec := httptest.NewRecorder()
	srv.Handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from /api/v1/readyz (no pool), got %d", rec.Code)
	}
}
