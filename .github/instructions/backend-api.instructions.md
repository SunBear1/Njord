---
description: >
  Rules for Cloudflare Pages Functions (backend API routes). Apply when reading or modifying
  any file in the functions/ directory. Covers API key secrecy, CF runtime constraints,
  caching strategy, CORS, and local development setup.
globs:
  - functions/**
---

# Backend — Cloudflare Pages Functions

## 1. Data Source Strategy — `/api/analyze`

**Primary:** Yahoo Finance (no API key required).
**Fallback:** Twelve Data — only activated when Yahoo returns **429 (rate limited)** and
`TWELVE_DATA_API_KEY` is configured as a CF Pages secret.

```typescript
// Fallback is rate-limit-only — do NOT fall back on other errors:
if (yahooError.code === 'RATE_LIMITED' && apiKey) {
  return fetchFromTwelveData(ticker, apiKey);
}
throw yahooError;  // bad ticker, network error, etc. → propagate as-is
```

`TWELVE_DATA_API_KEY` is **optional**. Without it the app works via Yahoo Finance alone.
- Local dev works without `.dev.vars`
- Set the CF Pages secret only for production resilience

---

## 2. Structured Error Codes

All `/api/analyze` errors must include a `code` field from `ErrorCode` type:

| Code | HTTP | When |
|------|------|------|
| `TICKER_NOT_FOUND` | 404 | Ticker doesn't exist on the data source |
| `RATE_LIMITED` | 429 | Rate limited on all configured sources |
| `INVALID_TICKER` | 400 | Missing or malformed ticker parameter |
| `UPSTREAM_ERROR` | 502 | Any other upstream failure |

Error response shape:
```typescript
{ error: string; code: ErrorCode }
```

Frontend `translateError()` switches on `code` — never do string matching on `error`.

---

## 3. Cloudflare Pages Function Constraints

Pages Functions run on the **Cloudflare Workers runtime** (V8 isolates), not Node.js.

**Available:** `fetch`, `Request`, `Response`, `URL`, `Headers`, `crypto`, `TextEncoder/Decoder`

**Not available:** `fs`, `path`, `process`, Node.js built-ins, `require()`, CommonJS modules

**CPU time limit (free tier):** 10ms per request. This is why **all financial computation
(GBM, Bootstrap, HMM) runs client-side.** Never move prediction models to the backend.

**What belongs in Pages Functions:**
- Fetching from external APIs that require server-side fetch (Yahoo Finance, Alior Kantor)
- Proxying third-party APIs to avoid browser CORS issues
- Edge caching to reduce external API calls
- No computation heavier than JSON parsing

---

## 4. Caching Strategy

| Route | Cache duration | Reason |
|-------|---------------|--------|
| `/api/analyze` | 1 hour (`max-age=3600`) | Stock prices change infrequently; reduces Yahoo requests |
| `/api/bonds` | 24 hours (`max-age=86400`) | Bond rates change at most monthly (new issuance) |
| `/api/currency-rates` | 1 minute (`max-age=60`) | Exchange rates update frequently |
| `/api/inflation` | 24 hours | CPI data is published monthly |

Set via `Cache-Control` response header:
```typescript
headers: { 'Cache-Control': 'max-age=3600' }
```

---

## 5. CORS

CORS is handled **globally** by `functions/_middleware.ts`. It injects CORS headers on every
`/api/*` response and handles `OPTIONS` preflight.

- Individual route handlers do NOT need to set CORS headers
- Do not bypass the middleware by returning early before `next()`
- The middleware applies to all routes under `functions/api/`

---

## 6. Error Handling Pattern

All handlers follow the same pattern:
1. Validate required parameters → 400 `INVALID_TICKER` if missing
2. Fetch from upstream APIs — throw `ApiError` with structured code on failure
3. Return JSON response with `Content-Type: application/json`

```typescript
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ticker = new URL(request.url).searchParams.get('ticker');
  if (!ticker) return errorResponse('INVALID_TICKER', 'Missing ticker', 400);

  try {
    const data = await fetchMarketData(ticker, env.TWELVE_DATA_API_KEY);
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' } });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err.code, err.message, err.status);
    return errorResponse('UPSTREAM_ERROR', String(err), 502);
  }
};
```

---

## 7. Local Development

```bash
npm run dev:full   # Runs Wrangler (CF runtime) + Vite together at localhost:8788
npm run dev        # Frontend only at localhost:5173 (no Pages Functions)
```

**`.dev.vars` file** (never commit — only needed for Twelve Data fallback):
```ini
TWELVE_DATA_API_KEY=your_api_key_here
```

Without `.dev.vars`, `/api/analyze` works via Yahoo Finance. The file is only needed
if you want to test the Twelve Data fallback path locally.

---

## 8. Route Structure

```
functions/
├── _middleware.ts        # Global CORS + Content-Type for all /api/* routes
└── api/
    ├── analyze.ts        # GET /api/analyze?ticker=X — Yahoo Finance (primary), Twelve Data (429 fallback) + NBP FX
    ├── bonds.ts          # GET /api/bonds — serves bond presets from CSV (max-age=86400)
    ├── currency-rates.ts # GET /api/currency-rates — exchange rates proxy (Alior + NBP Table C)
    └── inflation.ts      # GET /api/inflation — ECB HICP CPI proxy
```

Each `api/*.ts` exports `onRequestGet` (or `onRequest` for all methods).
