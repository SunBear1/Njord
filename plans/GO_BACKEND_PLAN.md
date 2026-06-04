# Njord — Go Backend Rewrite Agent Plan

## Overview

This document defines a step-by-step execution plan for an AI agent tasked with rewriting the Njord backend from TypeScript (Cloudflare Pages Functions) to Go (Cloudflare Worker via `syumai/workers`). The plan is incremental, test-driven, and designed to avoid breaking the live application at any stage.

---

## Constraints & Assumptions

- Cloudflare **free tier** — 10ms CPU limit per invocation. Heavy compute (Monte Carlo, HMM, Bootstrap) stays client-side until a paid tier is confirmed.
- WASM bundle must stay **under 3MB** — TinyGo should be preferred unless standard library features are strictly required.
- The Go Worker runs **alongside** existing Pages Functions during migration — they are not deleted until the Go equivalent is proven.
- All endpoints must have **unit tests** and at least one **integration test** before the TS version is decommissioned.
- D1, KV, and external API keys are injected via `wrangler.toml` bindings — never hardcoded.

---

## Repository Structure (Target)

```
Njord/
├── frontend/               ← unchanged React/TS SPA
├── functions/              ← legacy TS Pages Functions (deleted phase by phase)
├── worker/                 ← new Go Worker
│   ├── main.go
│   ├── go.mod
│   ├── go.sum
│   ├── wrangler.toml
│   ├── internal/
│   │   ├── handlers/
│   │   │   ├── market_data.go
│   │   │   ├── market_data_test.go
│   │   │   ├── bonds.go
│   │   │   ├── bonds_test.go
│   │   │   ├── currency_rates.go
│   │   │   ├── currency_rates_test.go
│   │   │   ├── inflation.go
│   │   │   ├── inflation_test.go
│   │   │   ├── auth.go
│   │   │   └── auth_test.go
│   │   ├── cache/
│   │   │   ├── kv.go
│   │   │   └── kv_test.go
│   │   ├── models/
│   │   │   ├── bond.go
│   │   │   ├── market.go
│   │   │   └── user.go
│   │   └── middleware/
│   │       ├── cors.go
│   │       ├── auth.go
│   │       └── middleware_test.go
│   └── testdata/
│       ├── bonds.csv
│       ├── market_response.json
│       └── nbp_response.json
```

---

## Phase 0 — Scaffolding & Tooling

### Goal
Bootstrap the Go Worker project and establish the CI pipeline before writing any handler logic.

### Steps

1. **Scaffold the Worker** using the official TinyGo template:
```bash
npm create cloudflare@latest -- --template github.com/syumai/workers/_templates/cloudflare/worker-tinygo
```

2. **Initialise Go module:**
```bash
go mod init github.com/SunBear1/njord-worker
go get github.com/syumai/workers
```

3. **Create `wrangler.toml`** with bindings for KV namespaces and D1:
```toml
name = "njord-worker"
compatibility_date = "2024-01-01"
main = "./build/worker.wasm"

[[kv_namespaces]]
binding = "CACHE"
id = "<your-kv-namespace-id>"

[[d1_databases]]
binding = "DB"
database_name = "njord"
database_id = "<your-d1-database-id>"
```

4. **Set up GitHub Actions CI** with the following jobs:
   - `go test ./...` — unit tests
   - `go vet ./...` — static analysis
   - `wrangler deploy --dry-run` — build validation

5. **Verify a hello-world handler deploys** and is reachable before writing any real logic.

### Exit Criteria
- Worker deploys successfully
- CI pipeline is green
- `/health` endpoint returns `200 OK`

---

## Phase 1 — Bonds Endpoint

### Goal
Rewrite `/api/bonds` — the simplest endpoint. It reads a CSV of bond presets and returns JSON. No external API calls. Ideal first target.

### Source to analyse
`functions/api/bonds.ts` — read the CSV parsing logic, the bond data shape, and the 24h cache strategy.

### Steps

1. **Define the Bond model** in `internal/models/bond.go`:
```go
type Bond struct {
    ID            string  `json:"id"`
    Name          string  `json:"name"`
    Rate          float64 `json:"rate"`
    Period        int     `json:"period"`
    Indexed       bool    `json:"indexed"`
}
```

2. **Write the CSV parser** in `internal/handlers/bonds.go`. Embed the CSV at build time using `//go:embed`:
```go
//go:embed ../../testdata/bonds.csv
var bondsCSV string
```

3. **Implement KV caching** in `internal/cache/kv.go` with a `Get(key)` / `Set(key, value, ttl)` interface that wraps the `syumai/workers` KV binding.

4. **Write the handler** — check KV first, parse CSV on miss, write back to KV with 24h TTL.

5. **Write tests:**

- `TestParseBondsCSV` — valid CSV returns correct slice of `Bond`
- `TestParseBondsCSV_MalformedRow` — malformed row is skipped without panic
- `TestBondsHandler_CacheHit` — handler returns cached value without re-parsing
- `TestBondsHandler_CacheMiss` — handler parses CSV and populates cache on miss
- `TestBondsHandler_ResponseShape` — JSON response matches expected schema

6. **Shadow test** — deploy alongside TS function, compare responses from both for 48h using a simple diff script.

7. **Decommission** `functions/api/bonds.ts` once responses match.

### Exit Criteria
- All 5 tests pass
- Response JSON is byte-for-byte identical to TS version (field names, types, ordering)
- KV cache TTL confirmed via manual inspection

---

## Phase 2 — Inflation Endpoint

### Goal
Rewrite `/api/inflation` — fetches HICP data from the ECB API, 24h KV cache. First endpoint with an external HTTP call.

### Steps

1. **Write an ECB API client** in `internal/handlers/inflation.go` using Go's standard `net/http`.

2. **Model the ECB response** — parse only the fields Njord actually uses (do not over-fetch).

3. **Implement retry logic** — one retry on 5xx or timeout, with a 500ms backoff. This matches resilience patterns implied by the TS version's fallback structure.

4. **Write tests:**

- `TestFetchInflation_Success` — mock HTTP server returns valid ECB XML/JSON, handler parses correctly
- `TestFetchInflation_CacheHit` — KV hit skips HTTP call entirely
- `TestFetchInflation_APIDown` — ECB returns 503, handler returns last cached value if available
- `TestFetchInflation_APIDown_NoCache` — ECB down AND no cache → returns `503` with descriptive error body
- `TestInflationHandler_TTL` — cache entry written with correct 24h TTL

5. **Shadow test** and decommission.

### Exit Criteria
- All 5 tests pass
- Handler degrades gracefully when ECB API is unavailable

---

## Phase 3 — Currency Rates Endpoint

### Goal
Rewrite `/api/currency-rates` — fetches from Alior Kantor and NBP Table C. Two external sources with potential for partial failure.

### Steps

1. **Write two separate clients**: `alior.go` and `nbp.go` inside `internal/handlers/`.

2. **Fetch both concurrently** using goroutines + `sync.WaitGroup` or `errgroup`:
```go
g, ctx := errgroup.WithContext(r.Context())
g.Go(func() error { return fetchAlior(ctx, &aliorRates) })
g.Go(func() error { return fetchNBP(ctx, &nbpRates) })
if err := g.Wait(); err != nil { ... }
```

3. **Write tests:**

- `TestFetchAliorRates_Success`
- `TestFetchNBPRates_Success`
- `TestCurrencyHandler_BothSources` — both succeed, merged response returned
- `TestCurrencyHandler_AliorFails` — Alior down, NBP-only response returned with partial flag
- `TestCurrencyHandler_BothFail` — both down, cached response returned
- `TestCurrencyHandler_Concurrent` — verify both fetches happen concurrently (timing-based assertion)

4. **Shadow test** and decommission.

### Exit Criteria
- All 6 tests pass
- Concurrent fetch confirmed — wall-clock time of handler is bounded by the slower of the two sources, not their sum

---

## Phase 4 — Market Data Endpoint

### Goal
Rewrite `/api/market-data` — the most complex data endpoint. Yahoo Finance primary source, Twelve Data fallback, NBP FX rate, 1h KV cache.

### Steps

1. **Write three clients**: `yahoo.go`, `twelvedata.go`, `nbp_fx.go`.

2. **Implement fallback logic** explicitly:
```go
price, err := fetchYahoo(ctx, ticker)
if err != nil {
    price, err = fetchTwelveData(ctx, ticker)
    if err != nil {
        return cachedOrError(ctx, kv, ticker)
    }
}
```

3. **Write tests:**

- `TestFetchYahoo_Success`
- `TestFetchYahoo_Malformed` — Yahoo returns unexpected shape, error is clean
- `TestFetchTwelveData_Success`
- `TestMarketData_YahooFails_FallsBackToTwelveData`
- `TestMarketData_BothFail_ReturnsCachedPrice`
- `TestMarketData_BothFail_NoCacheNoFallback` → `503`
- `TestMarketData_FXRate_Applied` — USD price is converted to PLN correctly
- `TestMarketData_CacheWritten_1hTTL`

4. **Shadow test** for at least 72h — market data is the most user-visible endpoint, extra caution warranted.

5. **Decommission** TS version.

### Exit Criteria
- All 8 tests pass
- FX conversion matches TS version to 4 decimal places
- Fallback chain confirmed via integration test with mocked failure injection

---

## Phase 5 — Auth Endpoints

### Goal
Rewrite `/api/auth/*` — JWT issuance, OAuth (GitHub + Google), D1-backed user storage. The highest-risk phase.

> **Note:** Do not begin this phase until all previous phases are decommissioned and stable for at least 1 week.

### Steps

1. **Audit the TS auth flow** in detail before writing any Go. Document:
   - JWT secret source (env var or D1?)
   - OAuth redirect URIs
   - D1 schema (users table columns, indexes)
   - Token expiry and refresh strategy

2. **Implement D1 client wrapper** in `internal/cache/d1.go` using `syumai/workers` D1 bindings.

3. **Implement handlers:**
   - `POST /api/auth/login` — OAuth code exchange
   - `GET /api/auth/callback/github`
   - `GET /api/auth/callback/google`
   - `POST /api/auth/refresh`
   - `POST /api/auth/logout`

4. **Implement JWT middleware** in `internal/middleware/auth.go`.

5. **Write tests:**

- `TestJWT_Issue` — token issued with correct claims and expiry
- `TestJWT_Verify_Valid`
- `TestJWT_Verify_Expired` → `401`
- `TestJWT_Verify_Tampered` → `401`
- `TestOAuth_GitHub_CodeExchange_Success`
- `TestOAuth_GitHub_CodeExchange_InvalidCode` → `400`
- `TestOAuth_Google_CodeExchange_Success`
- `TestD1_CreateUser` — new user written to D1 correctly
- `TestD1_GetUser_NotFound` → handler returns `404`
- `TestAuthMiddleware_ProtectedRoute_NoToken` → `401`
- `TestAuthMiddleware_ProtectedRoute_ValidToken` → `200`

6. **Run both TS and Go auth in parallel** on separate routes (`/api/auth/` vs `/api/auth-v2/`) — do not shadow-test auth with real user tokens.

7. **Migrate users** to new auth only after full manual QA.

### Exit Criteria
- All 11 tests pass
- OAuth flow tested end-to-end in staging with real GitHub and Google apps
- No D1 data loss confirmed before and after cutover

---

## Phase 6 — Middleware & Cross-Cutting Concerns

### Goal
Ensure CORS, error handling, logging, and request ID propagation are consistent across all handlers.

### Steps

1. **CORS middleware** — replicate exact allowed origins from TS version.
2. **Structured error responses** — all errors return `{"error": "...", "code": "..."}` JSON, never plain text.
3. **Request ID** — inject `X-Request-ID` header on every response for traceability.
4. **Write tests:**

- `TestCORS_AllowedOrigin`
- `TestCORS_DisallowedOrigin` → `403`
- `TestErrorResponse_Shape` — all error paths return valid JSON
- `TestRequestID_Present` — every response has `X-Request-ID`

---

## Phase 7 — Final Cleanup

### Steps

1. Delete the entire `functions/` directory once all TS endpoints are decommissioned.
2. Remove TS-related devDependencies from `package.json`.
3. Update `wrangler.toml` to remove any legacy Pages Function config.
4. Run `wasm-opt` on the final WASM binary — confirm size is under 3MB.
5. Update `README.md` to reflect the new architecture.
6. Tag the release as `v2.0.0-go-backend`.

---

## Test Coverage Requirements

| Phase | Min Unit Test Coverage |
|---|---|
| Bonds | 90% |
| Inflation | 90% |
| Currency Rates | 90% |
| Market Data | 85% |
| Auth | 95% |
| Middleware | 95% |

Run coverage with:
```bash
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

Coverage gate is enforced in CI — PRs below threshold are blocked.

---

## Agent Behaviour Guidelines

- **Never delete a TS function** until its Go replacement has passed all tests and a shadow period.
- **Never hardcode secrets** — always read from environment bindings.
- **Prefer standard library** over third-party packages wherever reasonable — keeps binary small.
- **One phase at a time** — do not begin the next phase until exit criteria for the current phase are fully met.
- **Commit after each test passes** — small, atomic commits make rollback safe.
- **If a test cannot be written** for a piece of logic, flag it in a `TODO` comment with an explanation — do not skip silently.