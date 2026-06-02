#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/../../.." && pwd)

cd "$REPO_ROOT"

if [ ! -f deploy/solr/solr-admin.env ]; then
  "${SCRIPT_DIR}/generate-solr-secrets.sh"
elif [ ! -f deploy/solr/security/security.json ]; then
  "${SCRIPT_DIR}/render-security-json.sh"
fi

docker compose --profile solr-setup up -d zookeeper
docker compose --profile solr-setup run --rm security-init
docker compose up -d solr
docker compose --profile solr-setup run --rm collections-init
"${SCRIPT_DIR}/healthcheck-solr.sh"
