# Backend — Cloudflare Pages Functions

This is the active backend (restored from git history after a reversed Epic 0 decision
to move to k3s/Go — see root `CLAUDE.md` and ICM `decisions-architecture-njord`).
`backend/` (Go) still exists in the repo but is not the deploy target.

## Route structure

```
functions/
├── _middleware.ts                    # Global CORS + Content-Type for all /api/* routes
├── api/v1/healthz.ts                 # liveness
└── api/v1/finance/
    ├── _shared/{db,errors,types}.ts  # ApiError/errorResponse, D1 query helpers, shared types
    ├── stocks/[ticker].ts, search.ts # Yahoo Finance
    ├── bonds/index.ts                # Polish bond presets — queried from D1 (FINANCE_DB)
    ├── currency/
    │   ├── rate.ts, history.ts, index.ts
    │   └── _adapters/{nbp,alior,walutomat}.ts
    └── inflation/{index,forecast}.ts # ECB HICP historical + forecast — queried from D1
```

`api/v1/auth/*` (register/login/logout/me/change-password/delete-account) is being ported
from `backend/internal/auth/*.go` onto D1 (`njord-users-db`) — see root CLAUDE.md Workflow.

## Error handling pattern

Use the helpers in `_shared/errors.ts` — never construct raw `Response` objects for errors:

```typescript
import { BAD_REQUEST, NOT_FOUND, UPSTREAM_ERROR, errorResponse } from '../_shared/errors';

if (!ticker) return errorResponse(BAD_REQUEST('Missing required param: ticker'));
// ... on upstream failure:
return errorResponse(UPSTREAM_ERROR(message, 'yahoo'));
```

Success responses: `{ ok: true, data: T }` (currency/*) or `{ data: T, _meta: ApiMeta }`
(bonds/inflation, via `_shared/types.ts` `ApiResponse<T>`) — match the existing sibling route's
shape when adding a new one, don't mix conventions within the same route family.

## Cloudflare Pages Function constraints

Pages Functions run on the **Cloudflare Workers runtime** (V8 isolates), not Node.js.

**Available:** `fetch`, `Request`, `Response`, `URL`, `Headers`, `crypto`, `TextEncoder/Decoder`

**Not available:** `fs`, `path`, `process`, Node.js built-ins, `require()`, CommonJS modules

**CPU time limit (free tier):** 10ms per request. This is why **all financial computation
(GBM, Bootstrap, HMM) runs client-side.** Never move prediction models to the backend.

**What belongs here:**
- Fetching from external APIs that require server-side fetch (Yahoo Finance, Alior Kantor, Walutomat, NBP)
- Proxying third-party APIs to avoid browser CORS issues
- D1 reads for the seeded finance cache (bonds, inflation) and for auth (`njord-users-db`)
- Edge caching to reduce external API calls
- No computation heavier than JSON parsing/shaping

## Caching strategy

Set `Cache-Control` on every success response — match existing routes' durations
(e.g. `currency/rate.ts` uses `public, max-age=86400` for a historical NBP lookup;
live/near-live routes use much shorter durations). Don't invent a new duration without
checking how volatile the underlying source actually is.

## CORS

Handled **globally** by `functions/_middleware.ts` — injects CORS headers on every
`/api/*` response and handles `OPTIONS` preflight. Individual route handlers must not
set CORS headers themselves or bypass the middleware by returning before `next()`.

## D1 bindings

Two databases, both bound via `wrangler.toml` / `infrastructure/pages.tf`:
- `FINANCE_DB` (`finance-data-db`) — bonds, inflation cache. Seeded by `scripts/ci/seed-*.ts`
  via `.github/workflows/update-finance-db.workflow.yaml`.
- `AUTH_DB` (`njord-users-db`) — auth (`users`, `oauth_accounts`). OAuth deferred to Epic 99;
  do not build OAuth routes now even though the table exists.

## Local development

```bash
npm run dev:full   # Wrangler (CF runtime) + Vite together at localhost:8788
npm run dev        # Frontend only at localhost:5173 (no Pages Functions)
```

`.dev.vars` (never commit — gitignored): `JWT_SECRET=...` required for auth once ported.
