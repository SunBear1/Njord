---
description: Helm chart authoring conventions for Njord. Apply when editing any file under infrastructure/helm/.
applyTo: "infrastructure/helm/**"
---

# Helm chart rules

Tags: **MUST** (enforced) · **SHOULD** (convention).

## Chart layout

- **MUST**: one chart per Njord component at `infrastructure/helm/njord-<component>/`. Components: `frontend`, `backend`, `postgres`, `platform` (app-of-apps wrapper).
- **MUST**: chart name in `Chart.yaml` = directory name (`njord-<component>`).
- **MUST**: Helm release name (in ArgoCD `Application.spec.source.helm.releaseName` or `helm install`) = `<component>` without the `njord-` prefix.
- **MUST**: `apiVersion: v2`, semver `version:` (chart) and `appVersion:` (image).

## Required labels on every rendered manifest

Every resource template must include via `_helpers.tpl`:

```yaml
metadata:
  labels:
    app.kubernetes.io/name: {{ .Chart.Name | trimPrefix "njord-" }}
    app.kubernetes.io/instance: {{ .Release.Name }}
    app.kubernetes.io/part-of: njord
    app.kubernetes.io/managed-by: {{ .Release.Service }}
    app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
    helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
```

Define `{{ define "njord.labels" }}` in `templates/_helpers.tpl` and reuse — **MUST NOT** duplicate label blocks inline.

## Namespace rules

- **MUST**: charts must NOT create their own namespace. Namespace is owned by the `njord-platform` chart (or ArgoCD Application via `syncOptions: CreateNamespace=true`).
- **MUST**: target namespace per component (binding from architecture.md):
  - `frontend`, `backend` → `njord-app`
  - `postgres` → `njord-data`
  - `traefik`, `cert-manager` → `njord-system`
  - all ArgoCD Applications → `argocd`

## Values

- **MUST**: `values.yaml` contains production-shape defaults; per-environment overrides via separate `values-<env>.yaml` (currently only `values-local.yaml`).
- **MUST**: NEVER commit secrets to `values*.yaml`. Use Kubernetes `Secret` resources with placeholder values; real values injected via ArgoCD repo creds, sealed-secrets, or `--set` at install (local dev).
- **MUST**: image references parameterized:

```yaml
image:
  repository: njord-frontend
  tag: ""              # defaults to .Chart.AppVersion if empty
  pullPolicy: IfNotPresent
```

- **SHOULD**: every value has a comment explaining purpose and acceptable range.

## Resource requests/limits

- **MUST**: every container declares `resources.requests` AND `resources.limits` for both CPU and memory.
- **MUST**: tuned to fit within node capacity (`role=app` = 2 CPU / 8 GB; `role=db-control` = 2 CPU / 16 GB).
- **SHOULD**: `requests.cpu` <= 25% of node, `limits.cpu` <= 50% of node for shared services.

## Node affinity

- **MUST**: every Deployment/StatefulSet pins via `nodeSelector` to the correct node role:
  - `frontend`, `backend` → `nodeSelector: { role: app }`
  - `postgres` → `nodeSelector: { role: db-control }`

## Probes

- **MUST**: every container has `livenessProbe`, `readinessProbe`, and (for slow starters) `startupProbe`.
- **MUST**: probes use HTTP endpoints under `/healthz` (liveness) and `/readyz` (readiness) — match the backend convention in Story 0.5.

## Templating discipline

- **MUST**: no logic in templates beyond `{{- if }}` `{{- range }}` `{{- with }}` and helper calls. Extract complex logic into `_helpers.tpl`.
- **MUST**: use `{{- ` / ` -}}` whitespace trimming consistently.
- **MUST**: quote string values: `{{ .Values.foo | quote }}` — Helm renders unquoted integers as numbers and can break YAML.
- **MUST**: every chart includes `NOTES.txt` summarizing how to access the deployed app locally.

## Validation (before every commit)

- **MUST**: `helm lint infrastructure/helm/njord-<component>`
- **MUST**: `helm template <release> infrastructure/helm/njord-<component> -f infrastructure/helm/njord-<component>/values-local.yaml | kubectl apply --dry-run=client -f -`
- **SHOULD**: `helm template ... | kubeconform -strict -` if kubeconform installed.

## Versioning

- **MUST**: bump `Chart.yaml: version` on every change (semver). Bump `appVersion` only when the image changes.
- **SHOULD**: PATCH for value tweaks, MINOR for new resources/templates, MAJOR for breaking value-schema changes.
