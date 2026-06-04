# Story 0.8 — Port Auth APIs (JWT, OAuth) to Go

**Status:** review
**Branch:** `feat/epic-0-story-0-8-auth-go`
**Chart bump:** `njord-backend` 0.2.0 → 0.3.0

## Summary

Replaces the Cloudflare Pages Functions in `functions/api/v1/auth/` with a
native Go implementation in `backend/internal/auth/`. The frontend hits the
exact same URLs (`/api/v1/auth/{register,login,logout,me,change-password,
delete-account}`) and the response/error envelope is preserved byte-for-byte,
so `frontend/hooks/useAuth.ts` requires no changes.

OAuth (GitHub/Google) is deferred to Epic 99 per the PRD; the
`linkedProviders` field stays in the public-user payload (always `[]`) so the
frontend shape contract is unchanged, but the OAuth UI in `AuthModal` and
`AccountPanel` is removed since there are no providers to link.

## Acceptance criteria — status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `/api/v1/auth/register` issued JWT cookie + created Postgres row | ✓ smoke-tested |
| 2 | `/api/v1/auth/login` validates bcrypt password and reissues cookie | ✓ |
| 3 | `/api/v1/auth/me` returns 401 without cookie, 200 with valid cookie | ✓ |
| 4 | `/api/v1/auth/logout` clears cookie | ✓ |
| 5 | `/api/v1/auth/change-password` requires current password | ✓ |
| 6 | `/api/v1/auth/delete-account` removes row + clears cookie | ✓ |
| 7 | Polish error messages preserved | ✓ verbatim from TS handlers |
| 8 | `functions/api/v1/auth/` deleted | ✓ entire subtree gone |
| 9 | `JWT_SECRET` injected from k8s Secret, generated once via Helm `lookup` | ✓ stable across upgrades |
| 10 | Backend exits 1 at startup when `DATABASE_URL` set but `JWT_SECRET` missing | ✓ fail-fast |
| 11 | OAuth (github/google) deferred — buttons + LinkedAccountRow removed | ✓ |
| 12 | Playwright suite still green | ✓ 41 passed |

## What changed

### Backend
- `backend/internal/auth/jwt.go` — HS256 sign/verify, 7-day expiry, alg/typ
  validation, base64url payload. Rejects `alg=none`.
- `backend/internal/auth/password.go` — bcrypt cost 10, explicit >72-byte
  rejection (bcrypt silently truncates otherwise).
- `backend/internal/auth/cookie.go` — `njord_auth` HttpOnly SameSite=Lax,
  Secure flag honours `X-Forwarded-Proto`.
- `backend/internal/auth/users.go` — pgxpool-backed CRUD, idempotent
  `CREATE TABLE IF NOT EXISTS users`. `oauth_accounts` omitted (no writer
  yet — would be dead code).
- `backend/internal/auth/handlers.go` — 6 handlers with Polish errors and
  envelope `{error, code}`.
- `backend/cmd/server/main.go` — wires `JWT_SECRET`, registers routes via
  `auth.NewHandlers(pool, secret).Register(mux)`.

### Helm
- `infrastructure/helm/njord-backend/templates/auth-secret.yaml` — new
  Secret `njord-auth-secret`. First install: `randAlphaNum 64 | b64enc`.
  Subsequent upgrades: `lookup` returns existing value so sessions survive.
- `infrastructure/helm/njord-backend/templates/deployment.yaml` —
  `JWT_SECRET` env from `valueFrom.secretKeyRef`.
- `Chart.yaml` bumped to 0.3.0.

### Frontend
- `frontend/components/AuthModal.tsx` — OAuth buttons + GitHubIcon/GoogleIcon
  removed.
- `frontend/components/AccountPanel.tsx` — Linked Accounts section,
  LinkedAccountRow component, and provider icons removed.
- `frontend/__tests__/auth.test.ts` deleted (tested CF-side internals that
  no longer exist). `getInitials` tests preserved in new file
  `userDisplayHelpers.test.ts`.

### Cloudflare Functions
- `functions/api/v1/auth/` removed in full (12 files: register/login/logout
  /me/change-password/delete-account, `_utils/*`, `github/*`, `google/*`).

## Validation evidence

```
go test ./...                       ok auth, cache, finance, seed
npx tsc --noEmit                    pass
npm run lint                        pass
npm test                            1268/1268 pass
npm run build                       pass (no bundle regressions)
tsc -p functions/tsconfig.json      pass
helm lint njord-backend             pass
helm template … | kubectl --dry-run pass
npx playwright test                 41/41 pass
```

### Live smoke (in-cluster, `http://njord.localhost/api/v1/auth`)

| Step | Result |
|------|--------|
| `POST /register {hunter22}` | 201 + Set-Cookie |
| `GET /me` (with cookie) | 200 + public user |
| `POST /logout` | 200 + cleared cookie |
| `GET /me` (after logout) | 401 `Nie jesteś zalogowany.` |
| `POST /login {hunter22}` | 200 |
| `POST /login {wrong}` | 401 `Nieprawidłowy email lub hasło.` |
| `POST /change-password` | 200 |
| `POST /login {newsecret9}` | 200 |
| `POST /delete-account` | 200 + cleared cookie |
| `POST /login` (after delete) | 401 `Nieprawidłowy email lub hasło.` |

## Deliberate departures from the TS implementation

- **bcrypt instead of PBKDF2(100k iterations)** — no legacy hashes to
  preserve (Postgres is fresh), and bcrypt is the conventional choice for
  new Go services. Hash format is `$2a$…` (bcrypt-native), not the
  `saltHex:hashHex` PBKDF2 format from CF.
- **Max password length tightened from 128 to 72** — bcrypt silently
  truncates inputs over 72 bytes, so we reject explicitly to avoid the
  surprise.
- **`oauth_accounts` table not created** — OAuth deferred to Epic 99 and
  the table has no writer in this story. `linkedProviders` always `[]`.

## Out of scope (deferred)

- OAuth GitHub/Google login & account-linking (Epic 99).
- Removal of remaining Cloudflare Pages Functions under `functions/api/v1/finance`
  and `functions/api/v1/healthz.ts` — kept until the cutover story.
- `infrastructure/terraform/` Cloudflare Pages config — no `.tf` files exist
  yet (Epic 99).
