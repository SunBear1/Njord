# Story 0.7 — Port remaining finance APIs (bonds, currency, inflation) to Go

**Status:** review
**Epic:** 0 — k3s migration
**Branch:** `feat/epic-0-story-0-7-finance-apis-go`

## Goal

Move the rest of the `/api/v1/finance/*` family off Cloudflare Pages Functions
into `njord-backend`, so all of the frontend's market-data hooks (currency,
bonds, inflation, NBP rate-of-day) hit the new Go stack.

## Acceptance criteria

- [x] `GET /api/v1/finance/bonds` — Postgres-backed; seeded from an embedded
      `bonds.csv` on startup; supports `type` and `is_family` filters; cached
      24 h via `Cache-Control`.
- [x] `GET /api/v1/finance/currency` — NBP Table C aggregator with `pairs` and
      `source` filters; Alior/Walutomat sources documented as deferred and
      return empty arrays (matches existing best-effort behaviour).
- [x] `GET /api/v1/finance/currency/rate?date=&currency=` — NBP Table A
      last-business-day-before-`date`; 24 h Postgres cache.
- [x] `GET /api/v1/finance/currency/history?currency=&days=` — NBP Table A
      last N rates; 1 h Postgres cache.
- [x] `GET /api/v1/finance/inflation` — Postgres-backed; lazily refreshed
      from stat.gov.pl's `inflacja.json` with a 24 h Postgres cache stamp;
      supports `from` and `to` filters (YYYY-MM).
- [x] `GET /api/v1/finance/inflation/forecast` — Postgres-backed; seeded
      from the embedded NBP forecast CSV; optional `report` selector.
- [x] All existing frontend hooks (`useBondPresets`, `useFinanceApi`,
      `useCurrencyRates`, `useMultiCurrencyRates`, `fetchNbpTableARate`,
      `useInflationData`, `assetDataProvider`) keep working unchanged — no
      frontend code modified.
- [x] Unit tests cover NBP client (PLN short-circuit, last-business-day
      selection, 404, history graceful failure, Table C partial fallback),
      currency handlers (validation + cache MISS→HIT), inflation handlers
      (validation), and bonds handler (validation).

## Implementation summary

- **`backend/internal/seed`** — embeds `data/bonds.csv` and
  `data/inflation_forecasts.csv` via `//go:embed`; `Apply` creates the finance
  tables (`bonds`, `inflation_historical`, `inflation_forecasts`) and
  idempotently upserts the static rows.
- **`backend/internal/finance/nbp.go`** — small NBP HTTP client with injectable
  base URLs (so tests run against `httptest`); covers Table A daily, Table A
  history, and Table C aggregate fetches.
- **`backend/internal/finance/bonds.go`** — handler reads from `bonds` table.
- **`backend/internal/finance/inflation.go`** — `InflationHandler` lazily
  refreshes GUS data on first request after a 24 h interval, then queries
  `inflation_historical`. `InflationForecastHandler` reads from
  `inflation_forecasts`.
- **`backend/internal/finance/currency.go`** — three handlers reusing the
  shared `Cacher` interface for 1 h / 24 h Postgres caches.
- **`backend/cmd/server/main.go`** — seeds on startup and wires all six
  routes.

## Validation evidence

```
go test ./...                                  # all green (cache, finance, server)
helm lint infrastructure/helm/njord-{backend,postgres}  # clean
helm upgrade --install backend …               # revision 4 deployed

# Bonds
curl njord.localhost/api/v1/finance/bonds      # 8 rows from embedded CSV

# Inflation
curl njord.localhost/api/v1/finance/inflation?from=2024-01&to=2025-12
  → 24 monthly CPI YoY values (lazy-loaded from stat.gov.pl, cached 24 h)
psql -c "SELECT COUNT(*) FROM inflation_historical" → 48 rows

curl njord.localhost/api/v1/finance/inflation/forecast    # 8 rows from NBP CSV

# Currency
curl -i njord.localhost/api/v1/finance/currency/rate?date=2025-04-10&currency=USD
  → MISS …{"rate":3.8828,"effectiveDate":"2025-04-09"}…
  re-issue → HIT
curl njord.localhost/api/v1/finance/currency/history?currency=USD&days=5
  → 5 daily NBP Table A mid rates
curl njord.localhost/api/v1/finance/currency?source=nbp
  → USD/PLN, EUR/PLN, GBP/PLN buy/sell/mid

npx tsc --noEmit && npm run lint && npm test && npm run build → green
  1292 unit tests passing
npx tsc --noEmit --skipLibCheck -p functions/tsconfig.json → clean
npx playwright test → 39/41 (2 known comparison flakes pass on isolated retry)
```

## Out of scope / deferred

- **Alior / Walutomat scraping adapters** — the existing CF function uses
  `Promise.allSettled` and accepts partial responses; for now the `?source=all`
  and `?source=alior|walutomat` modes return only NBP data (or empty for the
  latter two). Porting the HTML scrapers is tracked separately; this matches
  the architecture-doc note that pre-cloud-cutover all sources should remain
  best-effort.
- **Removing `functions/api/v1/finance/*`** — kept in-tree until the
  Cloudflare Pages deployment is retired (Story 0.10+).
- **GHCR push** — Epic 99.
