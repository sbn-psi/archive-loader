#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SOLR_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/../../.." && pwd)
APP_ENV="${REPO_ROOT}/.env"
SOLR_ADMIN_ENV="${SOLR_DIR}/solr-admin.env"

if [ ! -f "$APP_ENV" ] || [ ! -f "$SOLR_ADMIN_ENV" ]; then
  echo "Missing ${APP_ENV} or ${SOLR_ADMIN_ENV}" >&2
  exit 1
fi

set -a
source "$APP_ENV"
source "$SOLR_ADMIN_ENV"
set +a

BASE_URL="http://localhost:${SOLR_PORT:-8983}/solr"
admin_auth=("${SOLR_ADMIN_USER}:${SOLR_ADMIN_PASSWORD}")
loader_auth=("${SOLR_USER}:${SOLR_PASS}")
reader_auth=("${SOLR_READER_USER}:${SOLR_READER_PASSWORD}")

expect_code() {
  local expected=$1
  local label=$2
  shift 2
  local code
  code=$(curl --silent --output /dev/null --write-out '%{http_code}' "$@")
  if [ "$code" != "$expected" ]; then
    echo "FAIL ${label}: expected HTTP ${expected}, got ${code}" >&2
    return 1
  fi
  echo "OK ${label}: HTTP ${code}"
}

expect_code 401 "anonymous is rejected" "${BASE_URL}/admin/info/system?wt=json"
expect_code 200 "admin can read system info" --user "${admin_auth[0]}" "${BASE_URL}/admin/info/system?wt=json"
expect_code 200 "reader can query data" --user "${reader_auth[0]}" "${BASE_URL}/data/select?q=*:*&rows=0&wt=json"
expect_code 403 "reader cannot update data" --user "${reader_auth[0]}" -X POST -H 'Content-Type: application/json' --data-binary '{"commit":{}}' "${BASE_URL}/data/update?wt=json"
expect_code 403 "reader cannot use collection admin" --user "${reader_auth[0]}" "${BASE_URL}/admin/collections?action=LIST&wt=json"
expect_code 200 "loader can update data" --user "${loader_auth[0]}" -X POST -H 'Content-Type: application/json' --data-binary '{"commit":{}}' "${BASE_URL}/data/update?wt=json"

if curl --silent --show-error --fail --user "${admin_auth[0]}" \
  "${BASE_URL}/admin/collections?action=LIST&wt=json" | grep -q '"healthcheck_tmp"'; then
  expect_code 200 "admin removed stale healthcheck collection" --user "${admin_auth[0]}" "${BASE_URL}/admin/collections?action=DELETE&name=healthcheck_tmp&wt=json"
fi

expect_code 200 "loader can create a collection" --user "${loader_auth[0]}" "${BASE_URL}/admin/collections?action=CREATE&name=healthcheck_tmp&collection.configName=_default&numShards=1&replicationFactor=1&wt=json"
expect_code 200 "loader can delete a collection" --user "${loader_auth[0]}" "${BASE_URL}/admin/collections?action=DELETE&name=healthcheck_tmp&wt=json"
expect_code 200 "admin can list collections" --user "${admin_auth[0]}" "${BASE_URL}/admin/collections?action=LIST&wt=json"
expect_code 200 "admin can list configsets" --user "${admin_auth[0]}" "${BASE_URL}/admin/configs?action=LIST&wt=json"

echo "Collections:"
curl --silent --show-error --fail --user "${admin_auth[0]}" "${BASE_URL}/admin/collections?action=LIST&wt=json"
echo

echo "Configsets:"
curl --silent --show-error --fail --user "${admin_auth[0]}" "${BASE_URL}/admin/configs?action=LIST&wt=json"
echo
