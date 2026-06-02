#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 /path/to/existing/solrdata docker_named_volume" >&2
  echo "Example: $0 /var/solr/solrdata archive-loader_archiveloader-solr-data" >&2
  exit 1
fi

SOURCE_DIR=$1
TARGET_VOLUME=$2

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Source directory does not exist: ${SOURCE_DIR}" >&2
  exit 1
fi

docker volume create "$TARGET_VOLUME" >/dev/null

docker run --rm \
  -v "${SOURCE_DIR}:/from:ro" \
  -v "${TARGET_VOLUME}:/to" \
  alpine sh -c 'cd /from && tar cf - . | tar xf - -C /to'

docker run --rm \
  -v "${TARGET_VOLUME}:/var/solr" \
  alpine chown -R 8983:8983 /var/solr

echo "Copied ${SOURCE_DIR} into Docker volume ${TARGET_VOLUME}"
echo "The source directory was mounted read-only and was not modified."
