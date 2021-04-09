const express = require('express')
const router = express.Router()
const batchRouter = express.Router()
const db = require('../db.js')
const assert = require('assert')

async function processContextObject(object, type, fieldList, lidPrefix) {

    return new Promise(async (resolve, reject) => {
        let bailed = false
        // ensure input
        try {
            assert(object, "Failed to parse request")
    
        } catch (err) {
            reject(err.message)
            bailed = true
            return
        }
    
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
                assert(!object.logical_identifier || object.logical_identifier.startsWith(lidPrefix), `Expected ${object.logical_identifier} to start with ${lidPrefix}`)
            } catch (err) {
                reject(err.message)
                bailed = true
                return
            }
    
            object._timestamp = new Date()
        }
    
        if(!bailed) {validate(object)}
    
        if(bailed) { return }
    
        // pull out any new tags
        let newTags = []
        if(!!object.tags) {
            let associatedTags = object.tags
            let allTags = await db.find({ "type": type }, db.tags)
            for (associatedTag of associatedTags) {
                if(!allTags.find(tag => tag.name === associatedTag)) {
                    newTags.push({name: associatedTag, type: type})
                }
            }
        }
    
        // insert and return
        try {
            if(newTags.length > 0) { await db.insert(newTags, db.tags)}
            const result = await db.insert([object], type)
            resolve( result )
        } catch(err) {
            reject('Unexpected database error while saving')
            console.log(err);
        }
    })
        
}

const requiredTargetFields = [
    'logical_identifier',
    'display_name',
    'display_description']
router.post('/targets', async function(req, res) {
    processContextObject(req.body, db.targets, requiredTargetFields, 'urn:nasa:pds:context:target:').then(result => res.status(201).send(result), err => res.status(400).send(err))
})

const requiredMissionFields = ['logical_identifier',
'display_name',
'display_description']
router.post('/missions', async function(req, res) {
    processContextObject(req.body, db.missions, requiredMissionFields,'urn:nasa:pds:context:investigation:').then(result => res.status(201).send(result), err => res.status(400).send(err))
})

const requiredSpacecraftFields = ['logical_identifier',
'display_name']
router.post('/spacecraft', async function(req, res) {
    processContextObject(req.body, db.spacecraft, requiredSpacecraftFields, 'urn:nasa:pds:context:instrument_host:').then(result => res.status(201).send(result), err => res.status(400).send(err))
})

const requiredInstrumentFields = [
    'logical_identifier',
    'display_name',
    'display_description']
router.post('/instruments', async function(req, res) {
    processContextObject(req.body, db.instruments, requiredInstrumentFields, 'urn:nasa:pds:context:instrument:').then(result => res.status(201).send(result), err => res.status(400).send(err))
})

router.post('/target-relationships', async function(req, res) {
    processContextObject(req.body, db.targetRelationships, []).then(result => res.status(201).send(result), err => res.status(400).send(err))
})

const requiredToolFields = [
    'display_name',
    'url',
    'image_url',
    'toolId'
]
router.post('/tool', async function(req, res) {
    processContextObject(req.body, db.tools, requiredToolFields).then(result => res.status(201).send(result), err => res.status(400).send(err))
})

// Batch router

batchRouter.use(async function(req, res, next) {
    try {
        assert(req.body, "Couldn't parse request body")
        assert(req.body.length > 0, "Expected multiple objects")
    } catch(err) {
        next(err)
    }
    next()
})
batchRouter.post('/targets', async function(req, res) {
    Promise.all(req.body.map(object => processContextObject(object, db.targets, requiredTargetFields, 'urn:nasa:pds:context:target:'))).then(result => res.status(201).send(result), err => res.status(400).send(err))
})
batchRouter.post('/missions', async function(req, res) {
    Promise.all(req.body.map(object => processContextObject(object, db.missions, requiredMissionFields,'urn:nasa:pds:context:investigation:'))).then(result => res.status(201).send(result), err => res.status(400).send(err))
})
batchRouter.post('/spacecraft', async function(req, res) {
    Promise.all(req.body.map(object => processContextObject(object, db.spacecraft, requiredSpacecraftFields, 'urn:nasa:pds:context:instrument_host:'))).then(result => res.status(201).send(result), err => res.status(400).send(err))
})
batchRouter.post('/instruments', async function(req, res) {
    Promise.all(req.body.map(object => processContextObject(object, db.instruments, requiredInstrumentFields, 'urn:nasa:pds:context:instrument:'))).then(result => res.status(201).send(result), err => res.status(400).send(err))
})
batchRouter.post('/tool', async function(req, res) {
    Promise.all(req.body.map(object => processContextObject(object, db.tools, requiredToolFields))).then(result => res.status(201).send(result), err => res.status(400).send(err))
})

router.use('/batch', batchRouter)
module.exports = router