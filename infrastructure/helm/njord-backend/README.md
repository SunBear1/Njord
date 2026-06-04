# njord-backend

Go HTTP backend for Njord. Introduced in **Story 0.5** of Epic 0.

## What it deploys

| Resource     | Name             | Notes                                          |
|--------------|------------------|------------------------------------------------|
| `Deployment` | `backend`        | 1 replica, `nodeSelector: role=app`, probes on `/api/v1/health`. |
| `Service`    | `backend`        | ClusterIP :8080                                 |
| `Ingress`    | `backend`        | `ingressClassName: traefik`, host `njord.localhost`, path prefix `/api/v1` (more specific than frontend `/` — Traefik resolves longest match) |
| `Secret`     | `postgres-secret` | Mirror of the source Secret from `njord-data` namespace, providing `POSTGRES_USER/PASSWORD/DB` env vars |

## Build & load the image (local dev)

```bash
SHA=$(git rev-parse --short HEAD)
docker build -t njord-backend:dev-$SHA backend/
docker tag njord-backend:dev-$SHA njord-backend:latest
k3d image import njord-backend:dev-$SHA njord-backend:latest \
  -c njord-dev-cluster
```

## Install

```bash
helm install backend infrastructure/helm/njord-backend \
  --namespace njord-app --create-namespace \
  --set backend.version=dev-$(git rev-parse --short HEAD)

kubectl wait --for=condition=Available deployment/backend \
  -n njord-app --timeout=120s

# Smoke tests
curl -s --resolve njord.localhost:80:127.0.0.1 \
  http://njord.localhost/api/v1/health
# {"status":"ok","version":"dev-<sha>"}
```

## Database wiring

The chart mirrors `postgres-secret` from the `njord-data` namespace (where
the `njord-postgres` chart owns it) into the backend's namespace via the
Helm `lookup` helper. The Deployment then composes `DATABASE_URL`:

```
postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@postgres.njord-data.svc.cluster.local:5432/$(POSTGRES_DB)?sslmode=disable
```

Backend code reads `os.Getenv("DATABASE_URL")` in subsequent stories
(0.6–0.8) when ports start to need persistence.
