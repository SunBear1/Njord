---
description: Kubernetes manifest and cluster operation rules for Njord (ArgoCD Applications, raw manifests, kubectl workflows).
applyTo: "infrastructure/argocd/**,infrastructure/k8s/**,infrastructure/**/*.yaml"
---

# Kubernetes rules

Tags: **MUST** (enforced) · **SHOULD** (convention). Note: Helm-templated YAML under `infrastructure/helm/` is governed by `helm.instructions.md` — this file covers raw manifests (ArgoCD Applications, ConfigMaps, CRDs, app-of-apps roots).

## Cluster context

- **MUST**: the local cluster is `njord-dev-cluster` (k3d, 2 nodes). Production OCI cluster naming TBD (Epic 99).
- **MUST**: assume kubeconfig is at `~/.config/k3d/kubeconfig-njord-dev-cluster.yaml` or merged into `~/.kube/config` as context `k3d-njord-dev-cluster`. Always set `--context` explicitly in CI/scripts; never rely on current-context for destructive ops.
- **MUST**: bootstrap/teardown only via `./infrastructure/local/bootstrap.sh` and `./infrastructure/local/teardown.sh` — do not run raw `k3d cluster create/delete`.

## Namespaces (binding from architecture.md)

| Namespace | Purpose | Node label |
|---|---|---|
| `njord-system` | Shared infra (traefik, cert-manager) | `role=db-control` |
| `njord-data` | Postgres StatefulSet | `role=db-control` |
| `njord-app` | Frontend + backend | `role=app` |
| `argocd` | ArgoCD + all `Application` CRs | `role=db-control` |

- **MUST**: every workload lands in exactly one of the four namespaces above. Do not create ad-hoc namespaces.

## Naming

- **MUST**: ArgoCD `Application` names: `app-<component>` (e.g. `app-frontend`).
- **MUST**: ConfigMaps: `<component>-config`. Secrets: `<component>-secret`.
- **MUST**: ServiceAccount per workload: `<component>-sa` (least-privilege RBAC).
- **MUST**: image refs locally: `njord-<component>:dev-<git-short-sha>` or `:latest`. Production (Epic 99): `ghcr.io/sunbear1/njord-<component>:<semver>`.

## Required labels

Every manifest (raw or templated):

```yaml
metadata:
  labels:
    app.kubernetes.io/name: <component>      # frontend|backend|postgres|argocd|...
    app.kubernetes.io/part-of: njord
    app.kubernetes.io/managed-by: Helm       # or "Argo CD" for Application CRs
    app.kubernetes.io/version: <semver>
```

## Workload patterns

- **MUST**: every Deployment/StatefulSet pins to its node via `nodeSelector` (`role: app` or `role: db-control`).
- **MUST**: declare `resources.requests` AND `resources.limits` on every container.
- **MUST**: declare `livenessProbe`, `readinessProbe`. `startupProbe` for slow starters (Postgres, Go backend at cold start).
- **MUST**: `securityContext.runAsNonRoot: true` for application pods; postgres image runs as its own UID per chart defaults.
- **MUST**: `imagePullPolicy: IfNotPresent` for local-tagged images (`:dev-*`, `:latest`); `Always` only for explicit `:latest` in prod (Epic 99).
- **SHOULD**: `topologySpreadConstraints` deferred — irrelevant on 2-node single-replica setup.

## ArgoCD Applications

- **MUST**: declared as YAML under `infrastructure/argocd/applications/<name>.yaml`, applied by the app-of-apps root in `infrastructure/argocd/root.yaml`.
- **MUST**: `spec.project: njord` (the dedicated AppProject), not `default`.
- **MUST**: `syncPolicy.automated: { prune: true, selfHeal: true }` for app workloads. Disable automated sync only for stateful migrations.
- **MUST**: `syncOptions: [CreateNamespace=true, ServerSideApply=true]`.
- **MUST**: `source.repoURL` points to this GitHub repo; `targetRevision: main`; `path:` points to the Helm chart directory.

## Secrets

- **MUST**: never commit plaintext secrets. Locally, secrets live in `.gitignored` files or are injected via `kubectl create secret --dry-run=client -o yaml | kubectl apply -f -` from operator scripts.
- **MUST**: production secret strategy (sealed-secrets / external-secrets) is decided in Epic 99 — do not introduce now.
- **MUST**: Postgres credentials in `postgres-secret` (namespace `njord-data`); backend reads via `envFrom.secretRef`.

## kubectl workflow rules

- **MUST**: read-only verbs (`get`, `describe`, `logs`) freely. Mutating verbs (`apply`, `delete`, `patch`, `scale`, `rollout`) require explicit user confirmation when run outside an automated script.
- **MUST**: never `kubectl delete namespace njord-*` without confirmation — irreversible data loss.
- **MUST**: prefer `kubectl apply -f` over `kubectl create`; never `kubectl edit` for tracked resources (drift).
- **MUST**: include `--context k3d-njord-dev-cluster` in any kubectl command that mutates state inside CI or scripts.
- **SHOULD**: pipe through `| less` or `--no-headers` to keep output readable; `-o wide` for diagnostic queries; `-o jsonpath` for scripting.

## Validation gates for any manifest change

1. `kubectl apply --dry-run=client -f <file>` — schema valid
2. `kubectl apply --dry-run=server -f <file>` — admission controllers happy (preferred when cluster reachable)
3. After apply: `kubectl wait --for=condition=Available deployment/<name> -n <ns> --timeout=120s`
4. `kubectl get pods -n <ns>` shows no `CrashLoopBackOff` and `Restarts < 2`
5. Behavioral probe (curl, sql, playwright) per story acceptance criteria

## ResourceQuotas (Story TBD)

- **SHOULD**: every namespace eventually gets a `ResourceQuota` matching node capacity, to compensate for k3d's lack of per-node CPU enforcement at scheduler level (see Story 0.1 known limitation).
