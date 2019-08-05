// external modules
const assert = require('assert')
const request = require('request-promise-native')

// internal modules
require('../static/scripts/helpers.js')
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

app.post('/datasets/add', async function(req, res) {
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

    if(bailed) { return }

    // insert and return
    await db.connect()
    try {
        const result = await db.insert(toInsert, db.datasets)
        res.status(201).send( result.ops )
    } catch(err) {
        res.status(500).send('Unexpected database error while saving')
        console.log(err);
    }

})

async function processContextObject(req, res, type, fieldList) {
    let bailed = false
    // ensure input
    try {
        assert(req.body, "Failed to parse request")

    } catch (err) {
        res.status(400).send(err.message)
        bailed = true
        return
    }

    let object = req.body

    const validate = function(object) {
        const require = function(fieldname) {
            if(fieldname.constructor === Array) {
                for(field of fieldname) {
                    require(field)
                }
            } else {
                assert(object[fieldname], `Expected ${fieldname} to be present`)
            }
        }
        try {
            require(fieldList)
    
        } catch (err) {
            res.status(400).send(err.message)
            bailed = true
            return
        }

        object._timestamp = new Date()
    }

    if(!bailed) {validate(object)}

    if(bailed) { return }

    // insert and return
    await db.connect()
    try {
        const result = await db.insert([object], type)
        res.status(201).send( result.ops )
    } catch(err) {
        res.status(500).send('Unexpected database error while saving')
        console.log(err);
    }
}

app.post('/targets/add', async function(req, res) {
    await processContextObject(req, res, db.targets, [
        'logical_identifier',
        'display_name',
        'display_description',
        'image_url'])
})

app.post('/missions/add', async function(req, res) {
    await processContextObject(req, res, db.missions, [
        'logical_identifier',
        'display_name',
        'display_description'])
})

app.post('/spacecraft/add', async function(req, res) {
    await processContextObject(req, res, db.spacecraft, [
        'logical_identifier',
        'display_name',
        'display_description'])
})

app.post('/instruments/add', async function(req, res) {
    await processContextObject(req, res, db.instruments, [
        'logical_identifier',
        'display_name',
        'display_description'])
})

app.post('/target-relationships/add', async function(req, res) {
    await processContextObject(req, res, db.targetRelationships, [])
})

async function statusRequest(req, res, type) {
    await db.connect()
    const result = await db.find({}, type)
    res.status(200).send({
        count: result.length,
        lids: result.map(item => item.logical_identifier)
    })
}
app.get('/datasets/status', async function(req, res) {
    await statusRequest(req, res, db.datasets)
})
app.get('/targets/status', async function(req, res) {
    await statusRequest(req, res, db.targets)
})
app.get('/missions/status', async function(req, res) {
    await statusRequest(req, res, db.missions)
})
app.get('/spacecraft/status', async function(req, res) {
    await statusRequest(req, res, db.spacecraft)
})
app.get('/instruments/status', async function(req, res) {
    await statusRequest(req, res, db.instruments)
})

app.get('/target-relationships/status', async function(req, res) {
    await db.connect()
    const relationships = await db.find({}, db.targetRelationships)
    const targets = await db.find({}, db.targets)
    res.status(200).send({
        targets: targets.map(item => { return { lid: item.logical_identifier, name: item.display_name } }),
        relationships
    })
})

const fieldMapper = dataset => { return {
    name: dataset.title,
    lidvid: dataset.lidvid,
    abstract: dataset.description,
    browseUrl: '',
    target_lid: dataset.target_lid,
    target_name: dataset.target_name,
    mission_lid: dataset.mission_lid,
    instrument_lid: dataset.instrument_lid
}}
app.get('/datasets/check/bundle', async function(req, res) {
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


app.get('/datasets/check/collection', async function(req, res) {
    
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

app.get('/datasets/edit', async function(req, res) {
    await editLookupRequest(req, res, db.datasets)    
})

app.get('/targets/edit', async function(req, res) {
    await editLookupRequest(req, res, db.targets)    
})
app.get('/missions/edit', async function(req, res) {
    await editLookupRequest(req, res, db.missions)    
})
app.get('/spacecraft/edit', async function(req, res) {
    await editLookupRequest(req, res, db.spacecraft)    
})
app.get('/instruments/edit', async function(req, res) {
    await editLookupRequest(req, res, db.instruments)    
})

async function editLookupRequest(req, res, type) {
    try {
        assert(req.query.logical_identifier, 'Expected logical_identifier argument')
        assert(req.query.logical_identifier.startsWith('urn:nasa:pds:'), 'Expected logical_identifier to start with urn:nasa:pds')
    } catch (err) {
        res.status(400).send(err.message)
        return
    }

    await db.connect()
    const result = await db.find({ "logical_identifier": req.query.logical_identifier }, type)
    res.status(200).send( result )
}
app.get('/lookup', async function(req, res) {
    let lid = req.query.lid;
    let discovered;

    try {
        assert(lid, 'Expected lid parameter')
        discovered = await contextObjectLookupRequest(lid)
    } catch (err) {
        res.status(400).send(err.message)
        return
    }
    res.status(200).send(discovered);
})

async function contextObjectLookupRequest(lid) {
    let solrResponse = await httpRequest('https://pds.nasa.gov/services/search/search', {
        wt: 'json',
        identifier: lid
    })
    assert(solrResponse.response.numFound != 0, "Could not find context object with that identifier")
    assert(solrResponse.response.numFound == 1, "Found more than one context object with that identifier")
    return solrResponse.response.docs[0]
}

async function httpRequest(baseUrl, params) {
    const options = {
        uri: baseUrl,
        json: true,
        qs: params
    };
    return await request(options)
}




app.get('/datasets/export', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.datasets)
    res.status(200).send( solrize(result, "dataset") )
})
app.get('/targets/export', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.targets)
    res.status(200).send( result )
})
app.get('/instruments/export', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.instruments)
    res.status(200).send( result )
})
app.get('/missions/export', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.missions)
    res.status(200).send( result )
})
app.get('/spacecraft/export', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.spacecraft)
    res.status(200).send( result )
})