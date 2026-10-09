#!/bin/sh
set -eu

js_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

write_if_set() {
  if [ -n "$2" ]; then
    printf '  %s: "%s",\n' "$1" "$(js_escape "$2")"
  fi
}

config_file=/usr/share/nginx/html/config.js

{
  echo 'window.__APP_CONFIG__ = {'
  write_if_set VITE_KEYCLOAK_URL "${VITE_KEYCLOAK_URL:-}"
  write_if_set VITE_KEYCLOAK_REALM "${VITE_KEYCLOAK_REALM:-}"
  write_if_set VITE_KEYCLOAK_CLIENT_ID "${VITE_KEYCLOAK_CLIENT_ID:-}"
  write_if_set VITE_OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID "${VITE_OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID:-}"
  write_if_set VITE_OID4VC_PRE_AUTHORIZED "${VITE_OID4VC_PRE_AUTHORIZED:-}"
  echo '};'
} > "$config_file"

exec /docker-entrypoint.sh "$@"
