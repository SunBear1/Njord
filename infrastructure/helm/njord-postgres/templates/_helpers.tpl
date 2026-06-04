{{/*
Common helpers for njord-postgres chart.
Release name is intentionally "postgres" (component, no prefix) per
architecture.md §"Kubernetes Naming Conventions".
*/}}

{{- define "njord-postgres.name" -}}
postgres
{{- end -}}

{{- define "njord-postgres.fullname" -}}
postgres
{{- end -}}

{{- define "njord-postgres.chart" -}}
{{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end -}}

{{/*
Standard labels required by architecture.md.
*/}}
{{- define "njord-postgres.labels" -}}
app.kubernetes.io/name: postgres
app.kubernetes.io/part-of: njord
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ include "njord-postgres.chart" . }}
{{- end -}}

{{/*
Selector labels (subset of labels — must be stable across upgrades).
*/}}
{{- define "njord-postgres.selectorLabels" -}}
app.kubernetes.io/name: postgres
app.kubernetes.io/part-of: njord
{{- end -}}

{{/*
Resolve the Postgres password.

Order of precedence:
  1. Explicit `.Values.postgres.auth.password` (operator override).
  2. Existing in-cluster Secret (re-used on helm upgrade — prevents rotation).
  3. Newly generated 32-char random string (first install).
*/}}
{{- define "njord-postgres.password" -}}
{{- if .Values.postgres.auth.password -}}
{{ .Values.postgres.auth.password }}
{{- else -}}
{{- $existing := (lookup "v1" "Secret" .Release.Namespace "postgres-secret") -}}
{{- if and $existing $existing.data (index $existing.data "POSTGRES_PASSWORD") -}}
{{ index $existing.data "POSTGRES_PASSWORD" | b64dec }}
{{- else -}}
{{ randAlphaNum 32 }}
{{- end -}}
{{- end -}}
{{- end -}}
