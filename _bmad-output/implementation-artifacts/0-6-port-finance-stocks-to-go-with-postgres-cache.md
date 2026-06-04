# Story 0.6 — Port `/api/v1/finance/stocks` to Go with Postgres cache

**Status:** review
**Epic:** 0 — k3s migration
**Branch:** `feat/epic-0-story-0-6-stocks-go-port`

## Goal

Replace the Cloudflare Pages Function at `functions/api/v1/finance/stocks/[ticker].ts`
with a Go handler served by `njord-backend`, backed by a small Postgres-resident
cache (1h TTL). Frontend URL contract and JSON shape must remain identical so
`frontend/providers/assetDataProvider.ts` keeps working unchanged.

## Acceptance criteria

- [x] `GET /api/v1/finance/stocks/{ticker}?range=…&interval=…` is served by the
      Go backend, parity with the CF handler:
      - Ticker regex: `^[A-Z0-9.\-^=]+$`, length ≤ 20.
      - Intervals: `5m, 15m, 30m, 1h, 1d, 1wk, 1mo`.
      - Ranges: `1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y`.
      - `5m` max `1mo`; `1h` max `2y`.
      - Error mapping: Yahoo 429 → `502 UPSTREAM_ERROR`, 404 (HTTP or chart
        error `Not Found`) → `404 NOT_FOUND`, other chart.error → `502
        UPSTREAM_ERROR`.
- [x] Response shape exactly matches the CF handler:
      `{ data: StockBar[], _meta: { source: 'yahoo', currency, currentPrice,
      name, type: 'etf' | 'stock' } }`.
- [x] Postgres-backed cache table
      `cache (provider, key, value_json, expires_at)` created on startup with
      a PK on `(provider, key)`.
- [x] Cache TTL = 1 h; `X-Cache: HIT` on a second identical request, `MISS`
      otherwise.
- [x] Frontend hook URL unchanged
      (`/api/v1/finance/stocks/${ticker}?range=2y&interval=1d`).
- [x] Unit tests (mocked Yahoo + in-memory cache) cover happy path, validation,
      and all upstream-error mappings.
- [x] Integration test (`//go:build integration`) for the Postgres cache
      against a live DB pointed at by `DATABASE_URL`.

## Implementation summary

- **`backend/internal/cache`** — `Cache` over `pgxpool`, with `Init` to create
  the schema on first connect, `Get` returning `ErrMiss` for absent/expired
  rows, and `Set` upserting `(provider, key)` with a TTL.
- **`backend/internal/finance/stocks.go`** — `StocksHandler` validates query
  params, checks the cache, calls Yahoo on miss, stores the encoded response,
  and sets `X-Cache: MISS|HIT`. Yahoo base URL is injectable so tests can
  point at `httptest`.
- **`backend/cmd/server/main.go`** — opens a `pgxpool.Pool` from
  `DATABASE_URL`, runs `cache.Init`, and registers
  `GET /api/v1/finance/stocks/{ticker}`. Health endpoint is unchanged.
- **`infrastructure/helm/njord-postgres/templates/configmap.yaml`** — fixed:
  postgres now binds to `listen_addresses = '*'` (previously defaulted to
  `localhost` because our custom `postgresql.conf` overrode the upstream
  image's default).
- **`infrastructure/helm/njord-backend/Chart.yaml`** — bumped `version` and
  `appVersion` to `0.2.0`.

## Validation evidence

```
go test ./...                                           # all green
helm lint infrastructure/helm/njord-{backend,postgres}  # clean
helm upgrade --install backend …                        # revision 2 deployed

curl -i http://njord.localhost/api/v1/finance/stocks/AAPL?range=2y&interval=1d
  → HTTP/1.1 200 OK
    X-Cache: MISS
    {"data":[…],"_meta":{"source":"yahoo","currency":"USD",…}}

# Re-issued immediately:
  → X-Cache: HIT

curl http://njord.localhost/api/v1/finance/stocks/AAPL$    → 400
curl http://njord.localhost/api/v1/finance/stocks/AAPL?interval=2m → 400

npx tsc --noEmit && npm run lint && npm test && npm run build
  → 1292 unit tests passing, build green
npx tsc --noEmit --skipLibCheck -p functions/tsconfig.json → clean
npx playwright test → 40/41 passing (1 flake, passes on retry in isolation)
```

## Out of scope / deferred

- GHCR push + ArgoCD deploy of the new backend image — Epic 99.
- Removing `functions/api/v1/finance/stocks/[ticker].ts` — kept in-tree until
  the CF Pages deployment is shut off in Story 0.10+.
