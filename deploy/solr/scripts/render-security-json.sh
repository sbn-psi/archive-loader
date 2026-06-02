#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SOLR_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/../../.." && pwd)
APP_ENV="${REPO_ROOT}/.env"
SOLR_ADMIN_ENV="${SOLR_DIR}/solr-admin.env"
SECURITY_DIR="${SOLR_DIR}/security"
SECURITY_FILE="${SECURITY_DIR}/security.json"

if [ ! -f "$APP_ENV" ] || [ ! -f "$SOLR_ADMIN_ENV" ]; then
  echo "Missing ${APP_ENV} or ${SOLR_ADMIN_ENV}. Run deploy/solr/scripts/generate-solr-secrets.sh first." >&2
  exit 1
fi

set -a
source "$APP_ENV"
source "$SOLR_ADMIN_ENV"
set +a

hash_password() {
  local password=$1
  local salt_file hash_file salt_b64 hash_b64
  salt_file=$(mktemp)
  hash_file=$(mktemp)
  trap 'rm -f "$salt_file" "$hash_file"' RETURN

  openssl rand 32 > "$salt_file"
  {
    cat "$salt_file"
    printf '%s' "$password"
  } | openssl dgst -sha256 -binary | openssl dgst -sha256 -binary > "$hash_file"

  salt_b64=$(openssl base64 -A < "$salt_file")
  hash_b64=$(openssl base64 -A < "$hash_file")
  printf '%s %s' "$hash_b64" "$salt_b64"
}

mkdir -p "$SECURITY_DIR"

admin_hash=$(hash_password "${SOLR_ADMIN_PASSWORD:?}")
loader_hash=$(hash_password "${SOLR_PASS:?}")
reader_hash=$(hash_password "${SOLR_READER_PASSWORD:?}")

cat > "$SECURITY_FILE" <<EOF
{
  "authentication": {
    "class": "solr.BasicAuthPlugin",
    "blockUnknown": true,
    "credentials": {
      "${SOLR_ADMIN_USER}": "${admin_hash}",
      "${SOLR_USER}": "${loader_hash}",
      "${SOLR_READER_USER}": "${reader_hash}"
    }
  },
  "authorization": {
    "class": "solr.RuleBasedAuthorizationPlugin",
    "permissions": [
      {"name": "security-edit", "role": "admin"},
      {"name": "security-read", "role": "admin"},
      {"name": "config-edit", "role": "admin"},
      {"name": "config-read", "role": ["admin", "loader"]},
      {"name": "core-admin-edit", "role": "admin"},
      {"name": "core-admin-read", "role": "admin"},
      {"name": "schema-read", "role": ["admin", "loader", "reader"]},
      {"name": "schema-edit", "role": ["admin", "loader"]},
      {"name": "collection-admin-read", "role": ["admin", "loader"]},
      {"name": "collection-admin-edit", "role": ["admin", "loader"]},
      {"name": "update", "role": ["admin", "loader"]},
      {"name": "read", "role": ["admin", "loader", "reader"]}
    ],
    "user-role": {
      "${SOLR_ADMIN_USER}": "admin",
      "${SOLR_USER}": "loader",
      "${SOLR_READER_USER}": "reader"
    }
  }
}
EOF

chmod 600 "$SECURITY_FILE"
