const express = require('express')
const router = express.Router()
const db = require('../db.js')
const assert = require('assert')

router.post('/relationships', async function(req, res) {
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

    // insert and return
    try {
        const result = await db.insertRelationships(objects)
        res.status(201).send( result.ops )
    } catch(err) {
        res.status(500).send('Unexpected database error while saving')
        console.log(err);
    }
})

module.exports = router