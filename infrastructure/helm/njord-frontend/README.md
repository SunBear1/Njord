# njord-frontend

React SPA (Vite + nginx) served on `njord.localhost` via Traefik. Introduced
in **Story 0.4** of Epic 0.

## What it deploys

| Resource     | Name       | Notes                                         |
|--------------|------------|-----------------------------------------------|
| `Deployment` | `frontend` | 1 replica, `nodeSelector: role=app`, nginx serving `/usr/share/nginx/html` with SPA fallback to `index.html`. |
| `Service`    | `frontend` | ClusterIP :80                                  |
| `Ingress`    | `frontend` | `ingressClassName: traefik`, host `njord.localhost` |

## Build & load the image (local dev)

The chart references `njord-frontend:<tag>` which is intentionally **not**
pushed to any registry in Epic 0. Build it locally and import it into k3d:

```bash
SHA=$(git rev-parse --short HEAD)
docker build -f frontend/Dockerfile -t njord-frontend:dev-$SHA .
docker tag njord-frontend:dev-$SHA njord-frontend:latest
k3d image import njord-frontend:dev-$SHA njord-frontend:latest \
  -c njord-dev-cluster
```

## Install

```bash
helm install frontend infrastructure/helm/njord-frontend \
  --namespace njord-app --create-namespace

kubectl wait --for=condition=Available deployment/frontend \
  -n njord-app --timeout=120s

# Smoke test (requires `127.0.0.1 njord.localhost` in /etc/hosts on Linux;
# Chrome resolves *.localhost automatically).
curl -sI http://njord.localhost | head -3
```

## Hosts entry (Linux only)

Chrome and macOS resolve `*.localhost` to `127.0.0.1` automatically. On Linux,
add:

```
127.0.0.1 njord.localhost
```

to `/etc/hosts` (or use `curl --resolve njord.localhost:80:127.0.0.1 ...`).

## Pin image tag

```yaml
frontend:
  image:
    repository: njord-frontend
    tag: dev-abc1234
    pullPolicy: Never
```

`pullPolicy: Never` forbids the kubelet from contacting a registry — useful
when iterating on a locally-imported image.
