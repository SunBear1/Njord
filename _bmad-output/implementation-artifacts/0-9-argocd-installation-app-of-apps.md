# Story 0.9 — ArgoCD Installation + App-of-Apps

**Epic:** 0 — k3s/k3d migration
**Status:** review
**Branch:** `feat/epic-0-story-0-9-argocd`

## Summary

Install ArgoCD into the local k3d cluster and manage the four Njord Helm
charts (`njord-platform`, `njord-postgres`, `njord-backend`, `njord-frontend`)
via the app-of-apps GitOps pattern. Local admin password `test`; Cloudflare
Access SSO deferred to Epic 99.

## Deliverables

| Path | Purpose |
| --- | --- |
| `infrastructure/helm/njord-platform/` | Tiny chart owning the three `njord-*` namespaces with required `part-of=njord` labels. |
| `infrastructure/argocd/` | App-of-apps Helm chart: root `Application` + four child `Application` resources, each with `automated.{prune,selfHeal}=true`. |
| `infrastructure/local/install-argocd.sh` | Idempotent installer: `argo-cd 9.5.18` chart, admin/test bcrypt hash inlined, `server.extraArgs=[--insecure]`, seeds `njord-auth-secret` and `njord-app/postgres-secret` before bootstrapping app-of-apps. |
| `infrastructure/helm/njord-backend/templates/{secret,auth-secret}.yaml` | Made lookup-skip-on-miss instead of rendering empty values — see "Lookup under ArgoCD" below. |

## Acceptance Criteria — Status

| # | Criterion | Status | Evidence |
| - | --- | --- | --- |
| 1 | App-of-apps reconciles 4 children | ✅ | `kubectl get applications -n argocd` → 5 entries (root + 4), all Synced+Healthy |
| 2 | Each child has `automated.{prune,selfHeal}=true` + `syncOptions: [CreateNamespace=true]` | ✅ | `infrastructure/argocd/values.yaml` + `templates/applications.yaml` |
| 3 | UI reachable via port-forward | ✅ | `kubectl port-forward svc/argocd-server -n argocd 8080:443` → `https://localhost:8080` (admin/test) |
| 4 | Admin password = `test`, no SSO | ✅ | bcrypt hash inlined in `install-argocd.sh` line 13 |
| 5 | Chart structure follows `inpost_task/argocd/` reference (Chart.yaml + `application.*.yaml` templates) | ✅ | `infrastructure/argocd/templates/{root-application,applications}.yaml` |
| 6 | Deleting a Deployment triggers selfHeal within 3 min | ✅ | Manually deleted `deploy/backend` — restored in **5 s** (well under the 3 min ceiling). |

## Deviations / Known Issues

### Lookup under ArgoCD

Helm `lookup` cannot reach the cluster from ArgoCD's repo-server (it renders
chart manifests in isolation). Two of our templates relied on it:

* `njord-backend/templates/secret.yaml` — mirrors `postgres-secret` from
  `njord-data` to `njord-app`.
* `njord-backend/templates/auth-secret.yaml` — `randAlphaNum` fallback for
  `JWT_SECRET` on first install.

Without a fix, every ArgoCD reconcile rendered empty / freshly-random values
and overwrote the live secrets, breaking backend auth + DB connectivity.

**Fix applied:** both templates now skip rendering when `lookup` returns nil.
Secrets are seeded once by `install-argocd.sh` *before* the app-of-apps is
bootstrapped, and ArgoCD then leaves them alone (it doesn't manage what it
doesn't render). A safety-net `ignoreDifferences` entry on both secrets stays
in `infrastructure/argocd/values.yaml` in case `lookup` later partially
succeeds.

Long-term: replace with External Secrets Operator or cross-namespace
ServiceAccount + Secret API (deferred to a later platform-hardening story).

### StatefulSet vs ServerSideApply

The PostgreSQL StatefulSet picks up many server-defaulted fields
(`podManagementPolicy`, `dnsPolicy`, `terminationGracePeriodSeconds`,
`volumeClaimTemplates.{apiVersion,kind,status,volumeMode}`, etc.) that
ServerSideApply would surface as perpetual drift. The fix is to **omit**
`ServerSideApply=true` from the `syncOptions` on `app-postgres`, `app-backend`,
and `app-frontend` — client-side three-way merge ignores those defaults via
the `last-applied-configuration` annotation. `app-platform` keeps SSA because
plain namespace resources don't show this drift.

## Validation (Gates 1+4)

```
npx tsc --noEmit                  → ok
npm run lint                      → ok
npm test                          → 1268 / 1268
npm run build                     → ok
npx tsc -p functions/tsconfig.json → ok
npx playwright test               → 41 / 41
helm lint infrastructure/helm/{njord-backend,njord-platform}
                                  → 0 failures
helm lint infrastructure/argocd   → 0 failures
```

## Runtime Verification (Gates 2+3)

```
kubectl get applications -n argocd
NAME           SYNC STATUS   HEALTH STATUS
app-backend    Synced        Healthy
app-frontend   Synced        Healthy
app-of-apps    Synced        Healthy
app-platform   Synced        Healthy
app-postgres   Synced        Healthy

kubectl run -n njord-app smoke --rm -i --restart=Never --image=curlimages/curl \
  -- sh -c 'curl -sS -o /dev/null -w "%{http_code}\n" http://backend:8080/api/v1/auth/me'
# → 401 (no session) ✓ auth handler reached, new image deployed
```

selfHeal: `kubectl delete deploy/backend -n njord-app` → restored by ArgoCD
controller in 5 s.

## Out of scope (Epic 99)

- GHCR push for production-grade images.
- Cloudflare Access SSO for ArgoCD.
- Webhook-driven ArgoCD reconciliation on git push.
- Sealed-secrets / ESO replacement for the lookup-based bootstrap.
