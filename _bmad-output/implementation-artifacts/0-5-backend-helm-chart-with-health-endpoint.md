# Story 0.5: Backend Helm Chart with Health Endpoint

Status: review

## Story

As a **developer**,
I want a Go backend pod exposing `/api/v1/health`, routable via Traefik on the same hostname as the frontend,
so that the client can call the backend without CORS issues and I can prove the full request path works.

## Acceptance Criteria

1. Chart at `infrastructure/helm/njord-backend/` (architecture.md binding).
2. `helm install backend infrastructure/helm/njord-backend -n njord-app` creates:
   - Deployment (image `njord-backend:<tag>`, nodeSelector `role=app`, requests 200m/512Mi, limits 1500m/4Gi).
   - Service ClusterIP :8080.
   - Ingress (`ingressClassName: traefik`, host `njord.localhost`, path prefix `/api/v1`).
   - Secret mirror of `postgres-secret` from `njord-data` (via `lookup`).
3. `curl http://njord.localhost/api/v1/health` returns 200 with JSON `{"status":"ok","version":"<git-sha>"}`.
4. Deployment has liveness+readiness probes on `/api/v1/health` (initialDelay 5s/2s, period 5s).
5. Postgres connection injected as `DATABASE_URL` env var composed from `postgres-secret`.
6. Backend logs structured JSON to stdout (`log/slog` `JSONHandler` default).

## Tasks

- [x] Extend `backend/cmd/server/main.go` with `version` field + `slog` JSON logging; update tests
- [x] Scaffold `infrastructure/helm/njord-backend/` (Chart, values, helpers, deployment, service, ingress, secret mirror, README)
- [x] Gate 1 (helm lint + template + dry-run)
- [x] Gate 2 (k3d image import, install, Available, no restarts)
- [x] Gate 3 (curl /api/v1/health → 200 JSON; structured slog output verified)

## Dev Notes

- Path coexistence with frontend: Traefik resolves longest path-prefix first, so `/api/v1/*` hits backend and `/` falls through to frontend.
- `NJORD_VERSION` env (set from `--set backend.version=...`) → exposed in `/api/v1/health.version`.
- `DATABASE_URL` composition via `$(VAR)` interpolation in env (k8s expands references in env list).
