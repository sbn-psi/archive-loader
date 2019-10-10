// external modules
const assert = require('assert')

// internal modules
require('../static/scripts/helpers.js')
const db = require('./db.js')
const httpRequest = require('./httpRequest.js')

// env setup
if(!process.env.MINIO_ACCESS_KEY) {
    console.log('using local services.env file')
    require('dotenv').config({ path: 'services.env' })
}

// express, minio setup
console.log('connecting to file server...')
require('./minio.js').bootstrap().then(expressSetup, console.log)
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
app.use(bodyParser.json())

function expressSetup(minioHandler) {
    app.use('/image/upload', minioHandler)
    app.use(express.static('static'))
    app.listen(8989)
    console.log('running on port 8989...')
}


// // // EXPRESS ROUTING // // //
app.use('/relationship-types', require('./routes/relationship-types'))
app.use('/export', require('./routes/export'))
app.use('/tags', require('./routes/tags'))
app.use('/status', require('./routes/status'))
app.use('/related', require('./routes/related'))
app.use('/lookup', require('./routes/lookup'))
app.use('/edit', require('./routes/edit'))
app.use('/datasets/check', require('./routes/edit'))
app.use('/save', require('./routes/save-dataset'))
app.use('/save', require('./routes/save-context-object'))
app.use('/save', require('./routes/save-relationships'))
app.use('/solr', require('./routes/solr'))
