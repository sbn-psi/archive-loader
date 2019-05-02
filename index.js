// external modules
const {ObjectId} = require('mongodb')
const assert = require('assert')

// internal modules
require('./helpers.js')
const db = require('./db.js')
const solrize = require('./solrize.js')

// express setup
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('static'))
app.listen(8989)
console.log('running on port 8989...')

app.post('/add', function(req, res) {
    // ensure input
    try {
        assert(req.body, "Failed to parse request")
        // assert(req.body.name, "Name was not provided")
        // assert(req.body.version, "Version was not provided")
        // assert(req.body.startDate, "Start Date was not provided")

    } catch (err) {
        res.status(400).send(err.message)
        return
    }

    // pull fields out of request for db insert
    const { name, version, startDate } = req.body
    let record = req.body
    record.timestamp = new Date().toLocaleString()

    // insert and return
    db.connect(async function(dbConnection, complete) {
        const result = await db.insert(record, dbConnection)
        complete()
        let newRecord = result.ops[0]
        res.status(201).send( newRecord )
    })

})

app.get('/export', function(req, res) {
    db.connect(async function(dbConnection, complete) {
        const result = await db.find(dbConnection, {})
        complete()
        res.status(200).send( solrize(result, "dataset") )
    })
})