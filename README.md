# Archive Loader

The archive loader is a database, web server and client application used to load and manage the metadata used by the PDS Registry and Context Browser services. The front-end for the Context Browser can be found here: [https://github.com/sbn-psi/archive-viewer](https://github.com/sbn-psi/archive-viewer)

## Installation and Deployment

First, you will need to configure the services.env file that configures all the related services as part of this application stack. Start from the services-EXAMPLE.env file, and see below for explanation:

### services.env
- HARVEST: The URL for your deployment of the [PDS Harvest Server](https://github.com/sbn-psi/harvest-server)
- SOLR: The URL for your deployment of the [PDS Registry (Solr) Build 9b](https://pds-engineering.jpl.nasa.gov/content/pds4-software)
- SOLR_USER: The user, if any, for your running solr instance
- SOLR_PASS: The password, if any, for your running solr instance
- AUTH_SECRET: A randomized string for encrypting cookies
- ADMIN_USER: Your preferred username for the admin user
- ADMIN_PASS: Your preferred password for the admin user
- MINIO_ACCESS_KEY: A randomized username for the Minio server
- MINIO_SECRET_KEY: A randomized password for the Minio server
- MINIO_ENDPOINT: The host domain for the deployed minio server (This should be an IP address for development, or simply the domain without a path or scheme e.g. pdsregistryimages.psi.edu)
- MINIO_PORT: The port for the deployed minio server (Used primarily in development -- Optional)
- MINIO_SECURITY: true/false depending on whether or not the deployment uses https
- MINIO_BUCKET: the name of the bucket for uploading images on minio
- MINIO_UPLOADS_FOLDER_NAME: the name of the folder inside the bucket to place uploaded images

### Docker deployment
This application is hosted as a docker container, and should be instantiated along with the database by using docker-compose:

```bash
$ docker-compose build
$ docker-compose up -d
```

If you have the correct services.env file created, this will build and run your server at `http://localhost:8989/`. If the Archive Loader is running properly, you should see a web form with an input asking for a Bundle URL.

### PDS Schema

Part of this stack includes a service that will back up a copy of the PDS registry to a collection under our control. It does this by fetching records for each LID that we have supplemental metadata for, and importing it to another collection. This backup collection ("pds-" prefix) uses a schema distributed with the registry version 9b meant for use by Harvest, but **with some slight modifications**. These are...
- The `lid` and `lidvid` fields are no longer required
- The `<copyField source="lidvid" dest="identifier" />` rule is disabled
- `update.autoCreateFields` is enabled in the pds schema config

You must change these values via the [Solr Schema API](https://solr.apache.org/guide/7_7/schema-api.html) after deployment for the backup service to function correctly.

## Development

It may be useful to run this application outside of docker-compose for a faster build-run cycle. To do so, you will need to stand up each service independently. First, ensure your local services.env file lists the same MINIO credentials shown in services-EXAMPLE.env. You will also need a "data" directory in the root (create it if it doesn't exist). Then, in three separate terminals, run these commands in order:

```bash
$ npm run minio-dev
```
```bash
$ npm run mongo-dev
```
```bash
$ npm i
$ nodemon
```

## Troubleshooting

If you're having trouble running the server, try running docker-compose without the -d flag. This will then log the output of the output to the terminal, and you can see what might be going wrong.

If you need to connect to the database directly, you can do so by running:

```bash
$ docker exec -it mongo bash
```

which will put you inside a [bash environment of the databse](https://docs.mongodb.com/manual/mongo/), and then run:

```bash
$ mongo
```

From there you can [run commands on the database as documented here](https://docs.mongodb.com/manual/mongo/#working-with-the-mongo-shell). The application uses the database "app" and collection "datasets", primarily.

## Usage

Log in using the username and password specified in the services.env file. Then, you will be able to import and manage datasets and context objects, and sync them to your solr registries

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