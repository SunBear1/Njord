{{/*
Common helpers for njord-frontend chart.
*/}}

{{- define "njord-frontend.name" -}}
frontend
{{- end -}}

{{- define "njord-frontend.fullname" -}}
frontend
{{- end -}}

{{- define "njord-frontend.chart" -}}
{{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end -}}

{{- define "njord-frontend.labels" -}}
app.kubernetes.io/name: frontend
app.kubernetes.io/part-of: njord
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ include "njord-frontend.chart" . }}
{{- end -}}

{{- define "njord-frontend.selectorLabels" -}}
app.kubernetes.io/name: frontend
app.kubernetes.io/part-of: njord
{{- end -}}
