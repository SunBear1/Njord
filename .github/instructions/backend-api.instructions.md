---
description: >
  Rules for Cloudflare Pages Functions (backend API routes). Apply when reading or modifying
  any file in the functions/ directory. Covers API key secrecy, CF runtime constraints,
  caching strategy, CORS, and local development setup.
globs:
  - functions/**
---

# Backend — Cloudflare Pages Functions

## 1. API Key Secrecy — Critical

`TWELVE_DATA_API_KEY` is a Cloudflare Pages environment secret. It is **only accessible
server-side** in the Pages Function environment — it is never sent to the browser.

- Never log, return, or embed the API key in any response body
- Always guard for missing key and return 500 before attempting any external fetch:
  ```typescript
  if (!env.TWELVE_DATA_API_KEY) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 });
  }
  ```
- The `Env` interface must declare the key: `interface Env { TWELVE_DATA_API_KEY: string; }`
- Local development requires `.dev.vars` file (gitignored) with `TWELVE_DATA_API_KEY=...`

---

## 2. Cloudflare Pages Function Constraints

Pages Functions run on the **Cloudflare Workers runtime** (V8 isolates), not Node.js.

**Available:** `fetch`, `Request`, `Response`, `URL`, `Headers`, `crypto`, `TextEncoder/Decoder`

**Not available:** `fs`, `path`, `process`, Node.js built-ins, `require()`, CommonJS modules

**CPU time limit (free tier):** 10ms per request. This is why **all financial computation
(GBM, Bootstrap, HMM) runs client-side.** Never move prediction models to the backend.

**What belongs in Pages Functions:**
- Fetching from external APIs that require secret credentials (Twelve Data)
- Proxying third-party APIs to avoid browser CORS issues (Alior Kantor)
- Edge caching to reduce external API calls
- No computation heavier than JSON parsing

---

## 3. Caching Strategy

| Route | Cache duration | Reason |
|-------|---------------|--------|
| `/api/analyze` | 1 hour (`max-age=3600`) | Stock prices change infrequently during market hours; saves API quota |
| `/api/currency-rates` | 1 minute (`max-age=60`) | Exchange rates update frequently |
| `/api/inflation` | 24 hours | CPI data is published monthly |

Set via `Cache-Control` response header:
```typescript
headers: { 'Cache-Control': 'max-age=3600' }
```

Do not increase the analyze cache beyond 1 hour — Twelve Data free tier is 800 req/day.

---

## 4. CORS

CORS is handled **globally** by `functions/_middleware.ts`. It injects CORS headers on every
`/api/*` response and handles `OPTIONS` preflight.

- Individual route handlers do NOT need to set CORS headers
- Do not bypass the middleware by returning early before `next()`
- The middleware applies to all routes under `functions/api/`

---

## 5. Error Handling Pattern

All handlers follow the same pattern:
1. Validate required parameters → 400 if missing
2. Check environment secrets → 500 if missing
3. Fetch from upstream APIs in `Promise.all` → 500/429 on failure
4. Return JSON response with `Content-Type: application/json`

```typescript
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // 1. Validate
  const ticker = new URL(request.url).searchParams.get('ticker');
  if (!ticker) return new Response(JSON.stringify({ error: 'Missing ticker' }), { status: 400 });

  // 2. Check secrets
  if (!env.TWELVE_DATA_API_KEY) return new Response(..., { status: 500 });

  try {
    // 3. Fetch
    const data = await fetchFromUpstream(ticker, env.TWELVE_DATA_API_KEY);
    // 4. Return
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500 });
  }
};
```

---

## 6. Local Development

```bash
npm run dev:full   # Runs Wrangler (CF runtime) + Vite together at localhost:8788
npm run dev        # Frontend only at localhost:5173 (no Pages Functions)
```

**`.dev.vars` file** (never commit this):
```ini
TWELVE_DATA_API_KEY=your_api_key_here
```

This file is gitignored. Without it, `/api/analyze` returns a 500 error locally.

---

## 7. Route Structure

```
functions/
├── _middleware.ts        # Global CORS + Content-Type for all /api/* routes
└── api/
    ├── analyze.ts        # GET /api/analyze?ticker=X — stock data proxy (Twelve Data + NBP)
    ├── currency-rates.ts # GET /api/currency-rates — exchange rates proxy (Alior + NBP Table C)
    └── inflation.ts      # GET /api/inflation — ECB HICP CPI proxy
```

Each `api/*.ts` exports `onRequestGet` (or `onRequest` for all methods).
