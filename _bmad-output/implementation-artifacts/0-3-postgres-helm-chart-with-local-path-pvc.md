# Story 0.3: Postgres Helm Chart with Local-Path PVC

Status: review

## Story

As a **developer**,
I want a Helm chart that deploys a single-replica Postgres with persistent storage,
so that the backend has a database to hold cache, sessions, and future portfolio data.

## Acceptance Criteria

1. Chart lives at `infrastructure/helm/njord-postgres/` (per architecture.md binding, overrides epics path `infrastructure/charts/postgres`).
2. `helm install postgres infrastructure/helm/njord-postgres -n njord-data --create-namespace` creates:
   - Namespace `njord-data` (or assumes pre-existing if `--create-namespace`).
   - `StatefulSet` `postgres` — replicas=1, image `postgres:16-alpine`, `nodeSelector: role=db-control`.
   - `PersistentVolumeClaim` 10Gi against `storageClassName: local-path`.
   - `Service` ClusterIP exposing port 5432 (selector matches StatefulSet pod labels).
   - `Secret` `postgres-secret` holding `POSTGRES_PASSWORD`, `POSTGRES_USER=njord`, `POSTGRES_DB=njord` (generated on first install via `lookup` + `randAlphaNum`; re-uses existing value on upgrade).
   - `ConfigMap` `postgres-config` providing `postgresql.conf` overrides (`max_connections=50`, `shared_buffers=128MB`).
3. Pod reaches `Ready` within 60s of `helm install`.
4. `kubectl exec -n njord-data postgres-0 -- psql -U njord -d njord -c '\dt'` returns successfully (no relations expected — verifies connectivity).
5. `helm lint infrastructure/helm/njord-postgres` passes with no errors.
6. `helm template postgres infrastructure/helm/njord-postgres -n njord-data | kubectl apply --dry-run=client -f -` succeeds.
7. All required labels present on every manifest: `app.kubernetes.io/{name,part-of,managed-by,version}` per architecture.md naming conventions.
8. SealedSecret pattern documented in chart README for future cloud deployment (Epic 99).

## Tasks

- [x] Scaffold chart skeleton (Chart.yaml, values.yaml, templates/, README)
- [x] StatefulSet with PVC template + nodeSelector
- [x] Service ClusterIP
- [x] Secret (generated password) + ConfigMap (postgresql.conf overrides)
- [x] Gate 1 (helm lint + template + dry-run)
- [x] Gate 2 (kubectl wait Ready, no CrashLoopBackOff)
- [x] Gate 3 (psql connectivity)

## Dev Notes

- Naming binding per architecture.md §"Kubernetes Naming Conventions". Release name = `postgres` (component, no prefix). Chart name = `njord-postgres`.
- PostgreSQL image `postgres:16-alpine` — matches PRD's planned data layer.
- `lookup` template helper used for password generation so re-installs don't rotate the secret.
- Backend k8s connection string (used by future Story 0.5+): `postgres://njord:$PASSWORD@postgres.njord-data.svc.cluster.local:5432/njord`.
