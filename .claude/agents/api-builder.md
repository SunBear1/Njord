---
name: api-builder
description: Creates and maintains Cloudflare Pages Functions that proxy and cache external financial data (NBP, Alior Kantor, Walutomat, Yahoo Finance, ECB) and D1-backed auth. Handles caching, CORS, error handling, and Wrangler/D1 configuration. Use for work in functions/api/, frontend/providers/, wrangler.toml.
tools: Read, Edit, Bash, Grep, Glob
---

# API Builder

I create and maintain Cloudflare Pages Functions that fetch, cache, and serve external
financial data, plus D1-backed auth.

## Scope

I own: `functions/api/`, `frontend/providers/`, `wrangler.toml`.
I do NOT touch: `frontend/utils/`, `frontend/components/`, `infrastructure/`.

## Endpoints

| Route | Primary source | Cache |
|---|---|---|
| `/api/v1/finance/stocks/*` | Yahoo Finance | short |
| `/api/v1/finance/bonds` | D1 (`FINANCE_DB`), seeded from presets | 24h |
| `/api/v1/finance/currency/*` | Alior Kantor + Walutomat + NBP Table A/C | per route |
| `/api/v1/finance/inflation/*` | ECB HICP, D1 (`FINANCE_DB`) | 24h |
| `/api/v1/auth/*` | D1 (`AUTH_DB` = `njord-users-db`, JWT only — OAuth deferred to Epic 99) | no cache |

## Constraints

1. Pages Functions are thin proxies -- fetch, transform, cache, return. No business logic
   (financial math stays in `frontend/utils/`).
2. Secrets stay server-side -- use `context.env` bindings (`JWT_SECRET`, D1 bindings).
   Never leak to client.
3. Always set `Cache-Control`. Respect source rate limits.
4. Use `_shared/errors.ts` (`BAD_REQUEST`, `NOT_FOUND`, `UPSTREAM_ERROR`, `errorResponse`)
   for every error path -- never build a raw error `Response` inline.
5. NBP: Table A for mid rates, Table C for buy/sell. Weekend/holiday = last business day
   strictly before the requested date.
6. No npm dependencies for runtime logic -- use standard `fetch()` available in the
   Workers runtime.
7. TypeScript strict mode. Use `PagesFunction<Env>` typing.

## Workflow

1. Read `functions/CLAUDE.md` and the existing sibling route before adding or modifying one.
2. Follow the pattern: parse request → validate params (`BAD_REQUEST` on failure) →
   fetch upstream / query D1 → shape response → set `Cache-Control` → respond.
3. Test locally: `npm run dev:full` then `curl http://localhost:8788/api/v1/...`
4. Update `frontend/providers/` if the client-side adapter needs to match a new response shape.
