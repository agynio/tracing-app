{{- define "tracing-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "tracing-app.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := include "tracing-app.name" . -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "tracing-app.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" -}}
{{- end -}}

{{- define "tracing-app.labels" -}}
helm.sh/chart: {{ include "tracing-app.chart" . }}
{{ include "tracing-app.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
{{- end -}}

{{- define "tracing-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "tracing-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "tracing-app.nginxConfigName" -}}
{{- printf "%s-nginx" (include "service-base.fullname" .) -}}
{{- end -}}

{{- define "tracing-app.render" -}}
{{- $template := .template -}}
{{- $root := .context -}}
{{- $values := deepCopy $root.Values -}}
{{- $nginx := $values.nginx | default (dict) -}}
{{- $config := $nginx.config | default (dict) -}}
{{- if ($config.enabled | default false) -}}
  {{- $mount := dict "name" "nginx-template" "sourceName" (include "tracing-app.nginxConfigName" $root) "type" "configMap" "mountPath" "/etc/nginx/templates/default.conf.template" "subPath" "default.conf.template" "readOnly" true -}}
  {{- $mounts := $values.configMounts | default (list) -}}
  {{- $mounts = append $mounts $mount -}}
  {{- $values = set $values "configMounts" $mounts -}}
{{- end -}}
{{- $ctx := dict "Values" $values "Chart" $root.Chart "Capabilities" $root.Capabilities "Release" $root.Release "Files" $root.Files "Template" $root.Template -}}
{{- include $template $ctx -}}
{{- end -}}
