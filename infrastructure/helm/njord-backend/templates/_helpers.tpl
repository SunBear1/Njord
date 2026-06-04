{{/*
Common helpers for njord-backend chart.
*/}}

{{- define "njord-backend.name" -}}
backend
{{- end -}}

{{- define "njord-backend.fullname" -}}
backend
{{- end -}}

{{- define "njord-backend.chart" -}}
{{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end -}}

{{- define "njord-backend.labels" -}}
app.kubernetes.io/name: backend
app.kubernetes.io/part-of: njord
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ include "njord-backend.chart" . }}
{{- end -}}

{{- define "njord-backend.selectorLabels" -}}
app.kubernetes.io/name: backend
app.kubernetes.io/part-of: njord
{{- end -}}
