# Story 0.4: Frontend Helm Chart with Traefik Ingress

Status: review

## Story

As a **developer**,
I want the React SPA deployed as an nginx pod behind Traefik ingress on `njord.localhost`,
so that I can access the app at a real hostname matching the planned cloud setup.

## Acceptance Criteria

1. Chart lives at `infrastructure/helm/njord-frontend/` (architecture.md binding).
2. `helm install frontend infrastructure/helm/njord-frontend -n njord-app --create-namespace` creates: Deployment (replicas=1, nodeSelector `role=app`, image `njord-frontend:<tag>`), Service ClusterIP :80, `Ingress` with `ingressClassName: traefik` and host `njord.localhost`.
3. Traefik is re-enabled in `infrastructure/local/bootstrap.sh` (the `--disable=traefik@server:0` flag is removed; comment documents this is the Story 0.4 override of Story 0.1).
4. Frontend Dockerfile (`frontend.Dockerfile`) and nginx config (`frontend.nginx.conf`) live at repo root; multi-stage build emits an image <100 MB.
5. nginx SPA fallback works: `/comparison`, `/forecast`, etc. all return `index.html` (`try_files $uri $uri/ /index.html`).
6. nginx exposes `/healthz` → 200 for liveness/readiness probes.
7. Local smoke test passes: `curl -sI http://njord.localhost` returns 200 with `Content-Type: text/html`, and `curl -s http://njord.localhost/healthz` returns `ok`.
8. `helm lint` and `helm template | kubectl apply --dry-run=client` pass.

## Tasks

- [x] Remove Traefik disable from bootstrap.sh; recreate cluster
- [x] Add `frontend.Dockerfile` (Node 22 build → nginx-unprivileged runtime)
- [x] Add `frontend.nginx.conf` (SPA fallback + `/healthz`)
- [x] Scaffold chart: Chart.yaml, values.yaml, deployment, service, ingress, helpers
- [x] Gate 1 (helm lint + template + dry-run)
- [x] Gate 2 (k3d image import + helm install + Deployment Available)
- [x] Gate 3 (curl http://njord.localhost → 200; /healthz → 200; SPA route fallback)

## Dev Notes

- Image tag convention per architecture.md: `njord-frontend:dev-<git-short-sha>` plus `latest` for local. GHCR push deferred to Epic 99.
- Chrome resolves `*.localhost` to `127.0.0.1` automatically; Linux/Firefox may need a `/etc/hosts` entry — README documents both.
- TLS deliberately out of scope here — cert-manager arrives in Story 0.9 (platform chart).
