#!/usr/bin/env sh
set -eu

CONFIG_PATH="/tmp/env.js"

escape_js() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

api_base_url=$(escape_js "${API_BASE_URL:-}")
oidc_authority=$(escape_js "${OIDC_AUTHORITY:-}")
oidc_client_id=$(escape_js "${OIDC_CLIENT_ID:-}")
oidc_scope=$(escape_js "${OIDC_SCOPE:-}")

cat > "$CONFIG_PATH" <<EOF
window.__ENV__ = {
  API_BASE_URL: "${api_base_url}",
  OIDC_AUTHORITY: "${oidc_authority}",
  OIDC_CLIENT_ID: "${oidc_client_id}",
  OIDC_SCOPE: "${oidc_scope}",
};
EOF
