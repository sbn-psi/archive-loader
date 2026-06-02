# Local Solr Registry Deployment

Archive Loader can deploy the SBN legacy Solr registry as part of its own Docker Compose stack.

The registry image is built in the `en-registry-solr` repository and consumed here by tag. Runtime credentials and `security.json` are generated in this repository and are not baked into the image.

## One-Time Setup

Build or pull the registry image first. For a local sibling checkout:

```sh
cd ../en-registry-solr
deploy/sbn-solr/scripts/build-image.sh
cd ../archive-loader
```

Then generate local Solr credentials and start the full stack:

```sh
deploy/solr/scripts/generate-solr-secrets.sh
deploy/solr/scripts/setup-solr.sh
docker compose up -d app
```

`generate-solr-secrets.sh` writes the app-facing Solr values into the normal project `.env`:

```env
REGISTRY_IMAGE=en-registry-solr:local
SOLR_PORT=8983
SOLR=http://solr:8983/solr
SOLR_USER=archive-loader
SOLR_PASS=<generated>
```

`REGISTRY_IMAGE` and `SOLR_PORT` live in `.env` because Docker Compose uses the project `.env` when it expands `${...}` values in `docker-compose.yml`.

It writes Solr deployment-only values, including the Solr admin/reader credentials, heap size, and collection bootstrap settings, to `deploy/solr/solr-admin.env`. `deploy/solr/solr-admin.env.example` documents that file without containing real secrets.

`setup-solr.sh` starts ZooKeeper, uploads `deploy/solr/security/security.json`, starts Solr, uploads the registry configsets, creates the `registry` and `data` collections, and verifies the configured roles.

The configsets used during setup come from the `REGISTRY_IMAGE` image.

## Normal Updates

After the one-time setup, replace or pull the registry image and run:

```sh
deploy/solr/scripts/update-solr.sh
```

The Archive Loader application uses `SOLR`, `SOLR_USER`, and `SOLR_PASS` from the normal project `.env`, so switching between an external Solr and the in-stack Solr is just an `.env` change. Admin and reader credentials stay in `deploy/solr/solr-admin.env` for the Solr services and deployment scripts.

## Notes

- The project `.env`, `deploy/solr/solr-admin.env`, and `deploy/solr/security/security.json` are ignored by git.
- The Solr image includes the `registry`, `data`, and Solr `_default` configsets. Archive Loader's `web-*` publish collections can keep using `_default`.
- The `archive-loader` role can create/delete collections and post updates. The `arcnav-reader` role can query but cannot update or administer collections.
