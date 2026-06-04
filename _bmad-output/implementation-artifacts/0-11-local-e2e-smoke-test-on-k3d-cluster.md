# Story 0.11 — Local E2E Smoke Test on k3d Cluster

**Epic:** 0 — k3s/k3d migration
**Status:** review
**Branch:** `feat/epic-0-story-0-11-cluster-e2e`

## Summary

Add a second Playwright config that targets the live k3d cluster via Traefik
ingress, plus two new smoke specs (forecast against Yahoo Finance, JWT
register/login round-trip). Update the README with the cluster bring-up
flow. Also harden the install script and the three secret-emitting Helm
templates so ArgoCD never prunes or rotates the bootstrap secrets (root
cause for the auth/DB regressions hit during Story 0.9).

## Deliverables

| Path | Purpose |
| --- | --- |
| `playwright.cluster.config.ts` | Cluster-targeting config; no webServer; `PLAYWRIGHT_BASE_URL` override (defaults to `http://njord.localhost`). |
| `e2e-cluster/forecast.smoke.test.ts` | Hits `/forecast?ticker=SPY`, exercises the live Go backend + Yahoo data, asserts the Recharts SVG renders and no real console errors. |
| `e2e-cluster/auth.smoke.test.ts` | Opens the auth modal, registers a fresh user (`smoke+<ts>@njord.test`), asserts the `njord_auth` cookie is set and the login CTA disappears. |
| `package.json` | Adds `npm run test:e2e:cluster` script. |
| `README.md` | New "Running against the local k3d cluster" section. |
| `infrastructure/local/install-argocd.sh` | Seeds `njord-data/postgres-secret`, `njord-app/njord-auth-secret`, and `njord-app/postgres-secret` *before* the app-of-apps bootstrap; annotates each with `Prune=false` + `IgnoreExtraneous`. |
| `infrastructure/helm/njord-postgres/templates/secret.yaml` | Skips rendering when `lookup` returns nil so ArgoCD doesn't rotate the DB password on every reconcile. |

## Acceptance Criteria — Status

| # | Criterion | Status |
| - | --- | --- |
| 1 | `PLAYWRIGHT_BASE_URL=http://njord.localhost npx playwright test --config=playwright.cluster.config.ts` runs the cluster suite (no webServer) | ✅ `npm run test:e2e:cluster` |
| 2 | Existing local suite still passes against `npm run preview` | ✅ 41/41 |
| 3 | New smoke: `/forecast` fetches real SPY data, chart renders, no console errors | ✅ `e2e-cluster/forecast.smoke.test.ts` |
| 4 | New smoke: register + see authenticated state (JWT only, no OAuth) | ✅ `e2e-cluster/auth.smoke.test.ts` |
| 5 | README updated with local dev workflow (`bootstrap.sh` → `build-images.sh` → `install-argocd.sh` → `test:e2e:cluster`) | ✅ |
| 6 | Validation chain still holds for `frontend/` | ✅ tsc / lint / 1268 vitest / build / 5 helm charts / 41 e2e / 2 cluster e2e all green |

## Hardening that came out of Story 0.9 debugging

ArgoCD's repo-server can't run Helm `lookup`, so any template that uses
`lookup … randAlphaNum` rotates its content on every reconcile. Story 0.9
fixed two of the three affected templates (`njord-backend/secret.yaml`,
`njord-backend/auth-secret.yaml`); this story closes the loop on the third
(`njord-postgres/secret.yaml`) and on the bootstrap script:

- All three secrets (`njord-data/postgres-secret`, `njord-app/postgres-secret`
  mirror, `njord-app/njord-auth-secret`) are now seeded by
  `install-argocd.sh` **before** ArgoCD bootstrap.
- Each seeded secret is annotated `argocd.argoproj.io/sync-options=Prune=false`
  + `compare-options=IgnoreExtraneous`, so ArgoCD's automated prune leaves
  them alone even when the chart later renders nothing for them.
- `njord-postgres/templates/secret.yaml` now wraps the resource in a
  `lookup`-aware guard — when lookup returns nil and no explicit value was
  passed, the secret is simply not rendered (so ArgoCD doesn't push a fresh
  random password over the working one).

## Validation (Gates 1+3+4)

```
npx tsc --noEmit                  → ok
npm run lint                      → ok
npm test                          → 1268 / 1268
npm run build                     → ok
npx tsc -p functions/tsconfig.json → ok
helm lint infrastructure/helm/njord-{backend,frontend,platform,postgres} infrastructure/argocd
                                  → 0 failures
npx playwright test               → 41 / 41 (stubbed local suite)
PLAYWRIGHT_BASE_URL=http://njord.localhost \
  npx playwright test --config=playwright.cluster.config.ts
                                  → 2 / 2 (live cluster suite)
```

Backend pod (Gate 2): `kubectl get pods -n njord-app` → all Ready, no
CrashLoopBackOff, no restarts after the secret hardening.

## Out of scope (Epic 99)

- Wiring `npm run test:e2e:cluster` into CI (requires a k3d cluster in the
  runner — non-trivial; will land alongside the GHCR push pipeline).
- Replacing the bootstrap secret pattern with External Secrets Operator or a
  proper cross-namespace ServiceAccount + Secret API integration.
