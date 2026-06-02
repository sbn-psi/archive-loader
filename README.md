# Archive Loader

The archive loader is a database, web server and client application used to load and manage the metadata used by the PDS Registry and Context Browser services. The front-end for the Context Browser can be found here: [https://github.com/sbn-psi/archive-viewer](https://github.com/sbn-psi/archive-viewer)

## Installation and Deployment

First, you will need to configure the `.env` file that configures all the related services as part of this application stack. Start from `.env.example`, and see below for explanation:

### .env
- PORT: Optional server port override. Defaults to `8989`.
- APP_BASE_PATH: Optional URL base path for deployments behind a subpath, such as `/archive-loader`. Leave blank to serve from the site root.
- MONGO_URL: Optional Mongo connection string override. Defaults to `mongodb://localhost:27017` in local development and `mongodb://mongo:27017` in Docker production mode.
- HARVEST: The URL for your deployment of the [PDS Harvest Server](https://github.com/sbn-psi/harvest-server)
- REGISTRY_IMAGE: Docker image tag for the [Legacy Solr Registry](https://github.com/sbn-psi/en-registry-solr) service used by Docker Compose. Defaults to `en-registry-solr:local`.
- SOLR_PORT: Host port published by the in-stack Solr service. Defaults to `8983`.
- SOLR: The Solr URL used by the Archive Loader server. In Docker Compose this should be `http://solr:8983/solr`; for local development outside Compose it can point at any reachable Solr registry.
- SOLR_USER: The Solr user Archive Loader uses for collection administration and updates.
- SOLR_PASS: The Solr password Archive Loader uses for collection administration and updates.
- REGISTRY_URL: Optional override for the context-registry Solr endpoint used for lookups and supplemental metadata backup. Defaults to the SBN PDS alias endpoint.
- CONTEXT_BROWSER_FLUSH_URL: Optional override for the context-browser cache flush URL used after Solr sync.
- ARCNAV_REVALIDATE_URL: Optional POST endpoint for Archive Navigator refresh requests after a publish.
- ARCNAV_REVALIDATE_SECRET: Shared secret sent with Archive Navigator refresh requests.
- AUTH_SECRET: A randomized string for encrypting cookies
- ADMIN_USER: Your preferred username for the admin user
- ADMIN_PASS: Your preferred password for the admin user
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION: AWS credentials and region for both the image-upload bucket and the JSON backup bucket.
- S3_IMAGE_BUCKET: S3 bucket name for uploaded images used by the HTML editors and image fields.
- S3_IMAGE_PREFIX: Optional folder prefix inside `S3_IMAGE_BUCKET`. Defaults to `public`.
- S3_IMAGE_BASE_URL: Optional public base URL for uploaded images, such as a CloudFront distribution or public bucket URL. When omitted, the app uses the standard S3 virtual-hosted URL for the configured region.
- BACKUP_BUCKET: Optional S3 bucket name for JSON backups. Defaults to `pds-sbn-psi-archiveloader-backup`.

### Docker deployment
This application is hosted as a Docker container, and should be instantiated along with MongoDB, ZooKeeper, and the managed Solr registry by using Docker Compose.

Build or pull the Solr registry image first. For a local sibling checkout:

```bash
$ cd ../en-registry-solr
$ deploy/sbn-solr/scripts/build-image.sh
$ cd ../archive-loader
```

Then generate the Solr credentials and bootstrap the SolrCloud collections:

```bash
$ cp .env.example .env
$ deploy/solr/scripts/generate-solr-secrets.sh
$ deploy/solr/scripts/setup-solr.sh
```

`generate-solr-secrets.sh` writes Archive Loader's Solr connection values to `.env`, Solr admin/reader values to `deploy/solr/solr-admin.env`, and the generated BasicAuth payload to `deploy/solr/security/security.json`. Those generated files are ignored by git.

After Solr setup, build and run the full application stack:

```bash
$ docker compose build app
$ docker compose up -d app
```

If you have the correct `.env` file created, this will build and run your server at `http://localhost:8989/` by default. The Docker image now also builds the React frontend during `docker compose build`, and the React app is served from the site root.

If the Archive Loader is running properly, you should see the React frontend at `http://localhost:8989/`. The legacy AngularJS files are still kept in `static/` for reference, but they are no longer served by default.

See `deploy/solr/README.md` for Solr credential generation, health checks, and registry image update commands. The active Solr configsets are supplied by the registry image.

### PDS Schema

Part of this stack includes a service that will back up a copy of the PDS registry context products to a collection under our control. It does this by fetching records for each LID that we have supplemental metadata for, and importing it to another collection. This backup collection ("pds-" prefix) uses our own managed schema slightly adapted from the original. 

## Development

It may be useful to run this application outside of Docker Compose for a faster build-run cycle. To do so, make sure your local `.env` contains valid Mongo, Solr, harvest, and AWS/S3 settings. You will also need a `data` directory in the root (create it if it doesn't exist). Then, in two separate terminals, run these commands in order:

```bash
$ npm run mongo-dev
```
```bash
$ npm i
$ nodemon
```

## Troubleshooting

If you're having trouble running the server, try running `docker compose up app` without the `-d` flag. This logs the application, MongoDB, ZooKeeper, and Solr startup output to the terminal.

If you need to connect to the database directly, you can do so by running:

```bash
$ docker exec -it mongo bash
```

which will put you inside a [bash environment of the database](https://docs.mongodb.com/manual/mongo/), and then run:

```bash
$ mongo
```

From there you can [run commands on the database as documented here](https://docs.mongodb.com/manual/mongo/#working-with-the-mongo-shell). The application uses the database "app" and collection "datasets", primarily.

## Usage

Log in using the username and password specified in the `.env` file. Then, you will be able to import and manage datasets and context objects, and sync them to your solr registries

### Importing datasets
Paste the URL for a PDS4 Bundle directory, or toggle to Collection and paste a URL for a PDS4 Collection directory. Currently, this is whitelisted to these domains:
* pdssbn.astro.umd.edu
* sbnarchive.psi.edu

Once fetched, fill in the web form for each of the discovered bundles and collections, then submit. 

### Importing context objects
Add a target, instrument, mission or spacecraft. Paste the LID for the object into the first field, and the application will fetch the name, description, and relationships for that object. Then, fill out the rest of the form, adding custom values, tags, and specifying the nature of those relationships.

### Syncing data
The solr registry (and anything that uses it) is not automatically updated with changes in Archive Loader; they must be manually pushed, which is a somewhat heavy process. Therefore, the process in place requires us to create new collections in solr, push over the data, and then atomically update aliases to tell solr to use those new collections. As such, a unique name is required for these new collections, and Archive Loader will suggest one for you.

I tell you that to tell you this: Just click the button, and wait for the sync to finish. If there are any errors, or if the sync process seems to be taking too long (a few minutes or more), contact an administrator/developer.
