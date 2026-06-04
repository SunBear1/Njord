# ArgoCD app-of-apps for Njord

This Helm chart templates one root `Application` plus four child
`Application`s (`app-platform`, `app-postgres`, `app-backend`,
`app-frontend`) — together they form the GitOps control plane that owns
every Njord workload in the cluster.

## Bootstrap (local)

After ArgoCD itself is installed (see `infrastructure/local/install-argocd.sh`):

```bash
helm template app-of-apps infrastructure/argocd \
  --set global.repoURL="https://github.com/SunBear1/Njord" \
  --set global.targetRevision=main \
  | kubectl apply -n argocd -f -
```

ArgoCD then reconciles everything else from `main`; from this point on,
`helm upgrade` is **not** the way to ship changes. Commit + push instead.

## Layout

| App | Chart | Destination namespace | Sync wave |
|-----|-------|-----------------------|-----------|
| `app-platform` | `njord-platform` | `njord-system` | 0 |
| `app-postgres` | `njord-postgres` | `njord-data` | 1 |
| `app-backend` | `njord-backend` | `njord-app` | 2 |
| `app-frontend` | `njord-frontend` | `njord-app` | 2 |

All children have `automated.{prune, selfHeal}: true` and
`syncOptions: [CreateNamespace=true, ServerSideApply=true]`.

## Local admin password

`infrastructure/local/install-argocd.sh` sets the bundled admin user to
password `test` via a Helm value (bcrypt hash). This is for the
developer's k3d cluster only; Cloudflare Access SSO is deferred to
Epic 99.
