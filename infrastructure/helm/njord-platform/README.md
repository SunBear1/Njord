# njord-platform

Cluster-wide bootstrap chart owned by ArgoCD's `app-platform`. Today it
only declares the three Njord namespaces (`njord-system`, `njord-data`,
`njord-app`) with the required `app.kubernetes.io/part-of=njord` labels.

Future cluster-scoped concerns (shared Traefik middlewares, network
policies, monitoring CRDs) should live here so the per-service charts stay
focused on their own workloads.

## Local install

```bash
helm upgrade --install platform infrastructure/helm/njord-platform
```
