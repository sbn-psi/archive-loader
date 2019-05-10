# Archive Loader

The archive loader is a database, web server and client application used to load and manage the metadata used by the PDS Registry and Web UI services

## Installation

After cloning this repo be sure to install its dependencies:

```bash
$ npm install
```

Additionally, you will need these software stacks:
* [MongoDB Community Server](https://www.mongodb.com/download-center/community)
* [PDS Harvest Server](https://github.com/sbn-psi/harvest-server)
* [PDS Registry Build 9b or higher](https://pds-engineering.jpl.nasa.gov/content/pds4-software)

## Local Deployment

1. Start the node server

```bash
$ npm start
```

Or, consider using [nodemon](https://www.npmjs.com/package/nodemon) to keep the node server running and updated:

```bash
$ nodemon
```

2. Start the database server in a terminal window

```bash
$ mongod --dbpath=/data
```

3. Verify that the server is running

Navigate to `http://localhost:8989/`. If the Archive Loader is running properly, you should see a web form with an input asking for a Bundle URL.

## Usage

Paste the URL for a PDS4 Bundle directory, or toggle to Collection and paste a URL for a PDS4 Collection directory. Currently, this is whitelisted to these domains:
* pdssbn.astro.umd.edu
* sbnarchive.psi.edu

Once fetched, fill in the web form for each of the discovered bundles and collections, then submit. 