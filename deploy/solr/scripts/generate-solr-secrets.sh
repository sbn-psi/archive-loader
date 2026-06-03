#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SOLR_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/../../.." && pwd)
APP_ENV="${REPO_ROOT}/.env"
SOLR_ADMIN_ENV="${SOLR_DIR}/solr-admin.env"
OVERWRITE=${OVERWRITE:-false}

is_placeholder() {
  case "$1" in
    ""|" //REPLACEME//"|"REPLACEME"|"//REPLACEME//") return 0 ;;
    *) return 1 ;;
  esac
}

env_value() {
  local key=$1
  grep -E "^${key}=" "$APP_ENV" | tail -1 | cut -d= -f2-
}

if [ -e "$SOLR_ADMIN_ENV" ] && [ "$OVERWRITE" != "true" ]; then
  echo "${SOLR_ADMIN_ENV} already exists. Set OVERWRITE=true to replace it." >&2
  exit 1
fi

if [ -f "$APP_ENV" ] && [ "$OVERWRITE" != "true" ]; then
  for key in SOLR SOLR_USER SOLR_PASS; do
    if grep -q "^${key}=" "$APP_ENV"; then
      value=$(env_value "$key")
      if ! is_placeholder "$value"; then
        echo "${APP_ENV} already has ${key}. Set OVERWRITE=true to replace app-facing Solr settings." >&2
        exit 1
      fi
    fi
  done
fi

password() {
  openssl rand -base64 24 | tr -d '\n'
}

loader_password=$(password)

cat > "$SOLR_ADMIN_ENV" <<EOF
SOLR_HEAP=2048m

SOLR_ADMIN_USER=solr-admin
SOLR_ADMIN_PASSWORD=$(password)
SOLR_READER_USER=arcnav-reader
SOLR_READER_PASSWORD=$(password)

SOLR_COLLECTIONS="registry data"
SOLR_NUM_SHARDS=1
SOLR_REPLICATION_FACTOR=1
EOF

chmod 600 "$SOLR_ADMIN_ENV"

if [ -f "$APP_ENV" ]; then
  set_env() {
    local key=$1
    local value=$2
    if grep -q "^${key}=" "$APP_ENV"; then
      sed -i.tmp "s|^${key}=.*|${key}=${value}|" "$APP_ENV"
      rm -f "${APP_ENV}.tmp"
    else
      [ -s "$APP_ENV" ] && [ "$(tail -c 1 "$APP_ENV")" != "" ] && printf '\n' >> "$APP_ENV"
      printf '%s=%s\n' "$key" "$value" >> "$APP_ENV"
    fi
  }
  set_default_env() {
    local key=$1
    local value=$2
    if ! grep -q "^${key}=" "$APP_ENV"; then
      [ -s "$APP_ENV" ] && [ "$(tail -c 1 "$APP_ENV")" != "" ] && printf '\n' >> "$APP_ENV"
      printf '%s=%s\n' "$key" "$value" >> "$APP_ENV"
    fi
  }
  set_default_env REGISTRY_IMAGE "en-registry-solr:local"
  set_default_env SOLR_PORT "8983"
  set_env SOLR "http://solr:8983/solr"
  set_env SOLR_USER "archive-loader"
  set_env SOLR_PASS "$loader_password"
else
  cat > "$APP_ENV" <<EOF
REGISTRY_IMAGE=en-registry-solr:local
SOLR_PORT=8983
SOLR=http://solr:8983/solr
SOLR_USER=archive-loader
SOLR_PASS=${loader_password}
EOF
  chmod 600 "$APP_ENV"
fi

"${SCRIPT_DIR}/render-security-json.sh"

echo "Updated ${APP_ENV}"
echo "Generated ${SOLR_ADMIN_ENV}"
echo "Generated ${SOLR_DIR}/security/security.json"
echo
echo "Compose Solr settings:"
grep -E '^(REGISTRY_IMAGE|SOLR_PORT)=' "$APP_ENV"
echo
echo "App Solr settings:"
grep -E '^SOLR(_USER)?=' "$APP_ENV"
echo "SOLR_PASS=<written to ${APP_ENV}>"
echo
echo "Solr admin settings:"
grep -E '^(SOLR_HEAP|SOLR_ADMIN_USER|SOLR_READER_USER|SOLR_COLLECTIONS|SOLR_NUM_SHARDS|SOLR_REPLICATION_FACTOR)=' "$SOLR_ADMIN_ENV"
echo "SOLR_ADMIN_PASSWORD=<written to ${SOLR_ADMIN_ENV}>"
echo "SOLR_READER_PASSWORD=<written to ${SOLR_ADMIN_ENV}>"
