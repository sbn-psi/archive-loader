// external modules
const assert = require('assert')
const request = require('request-promise-native')

// internal modules
require('./static/helpers.js')
const db = require('./db.js')
const solrize = require('./solrize.js')

// express setup
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
app.use(bodyParser.json())
app.use(express.static('static'))
app.listen(8989)
console.log('running on port 8989...')

const HARVESTWRAPPER = (process.env.HARVEST ? process.env.HARVEST : 'http://localhost:3009') + '/extract'

app.post('/add', function(req, res) {
    let bailed = false
    // ensure input
    try {
        assert(req.body, "Failed to parse request")
        assert(req.body.bundle !== undefined, "Expected bundle to be specified")
        assert(req.body.collections, "Expected collections to be specified")

    } catch (err) {
        res.status(400).send(err.message)
        bailed = true
        return
    }

    const validateDataset = function(dataset) {
        const require = function(fieldname) {
            if(fieldname.constructor === Array) {
                for(field of fieldname) {
                    require(field)
                }
            }
            assert(dataset[fieldname], `Expected ${fieldname} to be present`)
        }
        try {
            require(
                'logical_identifier',
                'display_name',
                'display_description',
                'publication',
                )
    
        } catch (err) {
            res.status(400).send(err.message)
            bailed = true
            return
        }

        dataset._timestamp = new Date()
    }

    let toInsert = []
    for(dataset of [req.body.bundle, ...req.body.collections]) {
        if(!dataset || bailed) { continue }

        validateDataset(dataset)
        toInsert.push(dataset)
    }

    // pull fields out of request for db insert

    if(bailed) { return }

    // insert and return
    db.connect(async function(dbConnection, complete) {
        try {
            const result = await db.insert(toInsert, dbConnection)
            complete()
            res.status(201).send( result.ops )
        } catch(err) {
            res.status(500).send('Unexpected database error while saving')
            console.log(err);
        }
    })

})

app.get('/export', function(req, res) {
    db.connect(async function(dbConnection, complete) {
        const result = await db.find(dbConnection, {})
        complete()
        res.status(200).send( solrize(result, "dataset") )
    })
})

app.get('/status', function(req, res) {
    db.connect(async function(dbConnection, complete) {
        const result = await db.find(dbConnection, {})
        complete()
        res.status(200).send({
            count: result.length,
            lids: result.map(ds => ds.logical_identifier)
        })
    })
})

const fieldMapper = dataset => { return {
    name: dataset.title,
    lidvid: dataset.lidvid,
    abstract: dataset.description,
    browseUrl: ''
}}
app.get('/check/bundle', async function(req, res) {
    let bundleUrl = req.query.url;
    let discovered;
    
    try {
        discovered = await httpRequest(HARVESTWRAPPER, { url: bundleUrl })
        assert(discovered.bundles, 'Could not find any bundles at that URL')
        assert(discovered.bundles.length > 0, 'Could not find any bundles at that URL')
        assert(discovered.collections, 'Could not find any collections at that URL')
        assert(discovered.collections.length > 0, 'Could not find any collections at that URL')
    } catch (err) {
        res.status(400).send(err.message)
        return
    }

    const response = {
        bundle: discovered.bundles.map(fieldMapper)[0],
        collections: discovered.collections.map(fieldMapper)
    }
    res.status(200).send(response);
})


app.get('/check/collection', async function(req, res) {
    
    let bundleUrl = req.query.url;
    let discovered;

    try {
        discovered = await httpRequest(HARVESTWRAPPER, { url: bundleUrl })
        assert(discovered.collections, 'Could not find any collections at that URL')
        assert(discovered.collections.length > 0, 'Could not find any collections at that URL')
    } catch (err) {
        res.status(400).send(err.message)
        return
    }

    const response = {
        collections: discovered.collections.map(fieldMapper)
    }
    res.status(200).send(response);
})

app.get('/edit', function(req, res) {

    try {
        assert(req.query.lidvid, 'Expected lidvid argument')
        assert(req.query.lidvid.startsWith('urn:nasa:pds:'), 'Expected lidvid to start with urn:nasa:pds')
    } catch (err) {
        res.status(400).send(err.message)
        return
    }

    db.connect(async function(dbConnection, complete) {
        const result = await db.find(dbConnection, { "logical_identifier": req.query.lidvid })
        complete()
        res.status(200).send( result )
    })
})

async function httpRequest(baseUrl, params) {
    const options = {
        uri: baseUrl,
        json: true,
        qs: params
    };
    return await request(options)
}
