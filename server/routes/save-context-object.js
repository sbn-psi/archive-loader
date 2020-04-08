const express = require('express')
const router = express.Router()
const db = require('../db.js')
const assert = require('assert')

async function processContextObject(req, res, type, fieldList, lidPrefix) {
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
            assert(!object.logical_identifier || object.logical_identifier.startsWith(lidPrefix), `Expected ${object.logical_identifier} to start with ${lidPrefix}`)
        } catch (err) {
            res.status(400).send(err.message)
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
        res.status(201).send( result.ops )
    } catch(err) {
        res.status(500).send('Unexpected database error while saving')
        console.log(err);
    }
}

router.post('/targets', async function(req, res) {
    await processContextObject(req, res, db.targets, [
        'logical_identifier',
        'display_name',
        'display_description'],
        'urn:nasa:pds:context:target:')
})

router.post('/missions', async function(req, res) {
    await processContextObject(req, res, db.missions, [
        'logical_identifier',
        'display_name',
        'display_description'],
        'urn:nasa:pds:context:investigation:')
})

router.post('/spacecraft', async function(req, res) {
    await processContextObject(req, res, db.spacecraft, [
        'logical_identifier',
        'display_name'],
        'urn:nasa:pds:context:instrument_host:')
})

router.post('/instruments', async function(req, res) {
    await processContextObject(req, res, db.instruments, [
        'logical_identifier',
        'display_name',
        'display_description'],
        'urn:nasa:pds:context:instrument:')
})

router.post('/target-relationships', async function(req, res) {
    await processContextObject(req, res, db.targetRelationships, [])
})

router.post('/tool', async function(req, res) {
    await processContextObject(req, res, db.tools, [
        'display_name',
        'url',
        'image_url',
        'toolId'
    ])
})

module.exports = router