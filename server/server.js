// external modules
const assert = require('assert')

// internal modules
require('../static/scripts/helpers.js')
const db = require('./db.js')
const solrize = require('./solrize.js')
const httpRequest = require('./httpRequest.js')
const registry = require('./registry.js')

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
    await db.connect()

    // pull out any new tags
    let associatedTags = object.tags
    let allTags = await db.find({ "type": type }, db.tags)
    let newTags = []
    for (associatedTag of associatedTags) {
        if(!allTags.find(tag => tag.name === associatedTag)) {
            newTags.push({name: associatedTag, type: type})
        }
    }

    // insert and return
    try {
        if(newTags.length > 0) { await db.insert(newTags, db.tags)}
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

app.post('/relationships/add', async function(req, res) {
    let bailed = false
    // ensure input
    try {
        assert(req.body, "Failed to parse request")
        assert(req.body.constructor === Array, "Expected a list of relationships to add")
    } catch (err) {
        res.status(400).send(err.message)
        bailed = true
        return
    }
    
    let objects = req.body
    let possibleFields = ['target', 'instrument_host', 'instrument']
    for(doc of objects) {
        let fieldsPresent = 0
        for(field of possibleFields) {
            if(!!doc[field]) { fieldsPresent++ }
        }
        try {
            assert(fieldsPresent === 2, `Expected ${JSON.stringify(doc)} to contain exactly two of [${possibleFields.join(', ')}]`)
            assert(doc.relationshipId, `Expected relationshipId to be specified on ${JSON.stringify(doc)}`)
        } catch (err) {
            res.status(400).send(err.message)
            bailed = true
            return
        }
    }

    if(bailed) { return }
    await db.connect()

    // insert and return
    try {
        const result = await db.insertRelationships(objects)
        res.status(201).send( result.ops )
    } catch(err) {
        res.status(500).send('Unexpected database error while saving')
        console.log(err);
    }
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
const dbToFieldMap = {
    [db.targets]: 'target',
    [db.spacecraft]: 'instrument_host',
    [db.instruments]: 'instrument',
}
async function editLookupRequest(req, res, type) {
    try {
        assert(req.query.logical_identifier, 'Expected logical_identifier argument')
        assert(req.query.logical_identifier.startsWith('urn:nasa:pds:'), 'Expected logical_identifier to start with urn:nasa:pds')
    } catch (err) {
        res.status(400).send(err.message)
        return
    }

    await db.connect()
    const object = await db.find({ "logical_identifier": req.query.logical_identifier }, type)
    const relationships = await db.find({ [dbToFieldMap[type]]: req.query.logical_identifier }, db.objectRelationships)
    res.status(200).send( {
        object: object[0],
        relationships: relationships
    } )
}

const {contextObjectLookupRequest, lookupRelated} = registry

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

app.get('/related/target/', async function(req, res) {
    related(registry.type.target, req, res)
})
app.get('/related/spacecraft/', async function(req, res) {
    related(registry.type.spacecraft, req, res)
})
app.get('/related/mission/', async function(req, res) {
    related(registry.type.mission, req, res)
})
app.get('/related/instrument/', async function(req, res) {
    related(registry.type.instrument, req, res)
})
async function related(desiredType, req, res) {
    let discovered
    try {
        // assert(req.query.length > 0, 'Expected a query parameter "spacecraft", "mission", "instrument", or "type"')
        let type = Object.keys(req.query).first()
        assert(type, 'Expected a query parameter "spacecraft", "mission", "instrument", or "target"')
        let lid = req.query[type]
        
        discovered = await lookupRelated(type, desiredType, lid)
    } catch (err) {
        res.status(400).send(err.message)
        return
    }
    res.status(200).send(discovered)
}
app.get('/relationship-types/target', async function(req, res) {
    //TODO: build this dynamically
    res.status(200).send([
        {name: 'Primary', order: 1, relationshipId: 1},
        {name: 'Secondary', order: 2, relationshipId: 2},
        {name: 'Minor', order: 3, relationshipId: 3},
        {name: 'Serendipitous', order: 4, relationshipId: 4},
        {name: 'Calibration', order: 5, relationshipId: 5},
        {name: 'Ad Hoc', order: 6, relationshipId: 6},
        {name: 'Spurious', order: 7, relationshipId: 7}
    ])
})
app.get('/relationship-types/instrument', async function(req, res) {
    //TODO: build this dynamically
    res.status(200).send([
        {name: 'Science', order: 1, relationshipId: 1},
        {name: 'Support', order: 2, relationshipId: 2},
        {name: 'Derived', order: 3, relationshipId: 3},
        {name: 'Ancillary', order: 4, relationshipId: 4}
    ])
})

app.get('/targets/tags', async function(req, res) {
    await tagLookupRequest(req, res, db.targets)    
})
app.get('/missions/tags', async function(req, res) {
    await tagLookupRequest(req, res, db.missions)    
})
app.get('/spacecraft/tags', async function(req, res) {
    await tagLookupRequest(req, res, db.spacecraft)    
})
app.get('/instruments/tags', async function(req, res) {
    await tagLookupRequest(req, res, db.instruments)    
})

async function tagLookupRequest(req, res, type) {
    await db.connect()
    const result = await db.find({ "type": type }, db.tags)
    res.status(200).send( result.map(tag => tag.name) )
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
app.get('/target-relationships/export', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.targetRelationships)
    res.status(200).send( result )
})
app.get('/relationships/export', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.objectRelationships)
    res.status(200).send( result )
})