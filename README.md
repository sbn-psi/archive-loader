# Archive Loader

The archive loader is a database, web server and client application used to load and manage the metadata used by the PDS Registry and Web UI services

## Installation and Deployment

First, you will need a services.env file that lists the locations of the other services that this application requires. See the services-EXAMPLE.env file for how these should be configured. Set the URLs for your deployments of the [PDS Harvest Server](https://github.com/sbn-psi/harvest-server) and [PDS Registry Build 9b or higher](https://pds-engineering.jpl.nasa.gov/content/pds4-software) in this file.

This application is hosted as a docker container, and should be instantiated along with the database by using docker-compose:

```bash
$ docker-compose build
$ docker-compose up -d
```

If you have the correct services.env file created, this will build and run your server at `http://localhost:8989/`. If the Archive Loader is running properly, you should see a web form with an input asking for a Bundle URL.

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

Paste the URL for a PDS4 Bundle directory, or toggle to Collection and paste a URL for a PDS4 Collection directory. Currently, this is whitelisted to these domains:
* pdssbn.astro.umd.edu
* sbnarchive.psi.edu

Once fetched, fill in the web form for each of the discovered bundles and collections, then submit. 