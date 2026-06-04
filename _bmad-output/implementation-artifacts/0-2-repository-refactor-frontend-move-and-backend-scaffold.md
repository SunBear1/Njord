# Story 0.2: Repository Refactor — Frontend Move & Backend Scaffold

Status: review

## Story

As a **developer**,
I want `src/` renamed to `frontend/` and a `backend/` Go module scaffolded,
so that the monorepo layout reflects the new client/server split required by Epic 0.

## Acceptance Criteria

1. `src/` renamed to `frontend/` via `git mv` (history preserved).
2. All build/config touchpoints updated to the new path: `vite.config.ts`, `tsconfig.app.json`, `tsconfig.test.json`, `tsconfig.json`, `functions/tsconfig.json`, `eslint.config.js`, `package.json` scripts, `index.html`, `playwright.config.ts`, `scripts/generate-pairings.ts`, `scripts/generate-test-report.ts`, `.github/workflows/*`.
3. `backend/go.mod` exists with module `github.com/SunBear1/Njord/backend`.
4. `backend/cmd/server/main.go` starts an HTTP server on `:8080` and serves `GET /api/v1/health` with status 200 and JSON `{"status":"ok"}`.
5. `backend/Dockerfile` is multi-stage with a `gcr.io/distroless/static-debian12:nonroot` final image; built image is <20 MB.
6. `go build ./...` and `go test ./...` succeed from `backend/`.
7. All Twelve Data dead-code is removed: provider file renamed (`twelveDataProvider.ts` → `assetDataProvider.ts`), `TWELVE_DATA_API_KEY` field removed from `functions/api/v1/auth/_utils/types.ts`, `source: 'twelvedata'` removed from `frontend/types/marketData.ts`, and Polish UI/docs strings updated (Twelve Data → Yahoo Finance).
8. Full validation chain passes: `npx tsc --noEmit && npm run lint && npm test && npm run build && npx tsc --noEmit --skipLibCheck -p functions/tsconfig.json && npx playwright test`.

## Tasks

- [x] Phase A: Remove Twelve Data dead code
- [x] Phase B: Scaffold `backend/` Go module + Dockerfile
- [x] Phase C: `git mv src/ frontend/` and update all config touchpoints
- [x] Phase D: Run full validation chain

## Dev Notes

- Naming binding per `_bmad-output/planning-artifacts/architecture.md` — image will be `njord-backend:dev-<sha>` (build in Story 0.10).
- Backend is intentionally minimal in this story — only `/api/v1/health`. Real API ports happen in Stories 0.6–0.8.
- Docs sweep (CLAUDE.md, AGENTS.md, .github/instructions/*.md) updated where `src/` paths appear in non-historical guidance.
