const express = require('express')
const router = express.Router()
const db = require('../db.js')
const assert = require('assert')

router.post('/datasets', async function(req, res) {
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

    const require = function(dataset, fieldname) {
        if(fieldname.constructor === Array) {
            for(field of fieldname) {
                require(dataset, field)
            }
        } else {
            assert(dataset[fieldname], `Expected ${fieldname} to be present`)
        }
    }
    const validateBundle = function(bundle) {
        try {
            require(bundle, [
                'primary_context',]
                )
    
        } catch (err) {
            res.status(400).send(err.message)
            bailed = true
            return
        }
    }
    const validateDataset = function(dataset) {
        try {
            require(dataset, [
                'logical_identifier',
                'display_name',
                'display_description',
                'browse_url',]
                )
    
        } catch (err) {
            res.status(400).send(err.message)
            bailed = true
            return
        }

        dataset._timestamp = new Date()
    }

    let toInsert = []
    let newTags = []
    if(!!req.body.bundle) {
        validateBundle(req.body.bundle)
    }
    for(dataset of [req.body.bundle, ...req.body.collections]) {
        if(!dataset || bailed) { continue }

        validateDataset(dataset)
        toInsert.push(dataset)

        // pull out any new tags
        if(!!dataset.tags) {
            let associatedTags = dataset.tags
            let allTags = await db.find({ "type": db.datasets }, db.tags)
            for (associatedTag of associatedTags) {
                if(!allTags.find(tag => tag.name === associatedTag)) {
                    newTags.push({name: associatedTag, type: db.datasets})
                }
            }
        }
    }

    if(bailed) { return }

    // insert and return
    try {
        if(newTags.length > 0) { await db.insert(newTags, db.tags)}
        const result = await db.insert(toInsert, db.datasets)
        res.status(201).send( result )
    } catch(err) {
        res.status(500).send('Unexpected database error while saving')
        console.log(err);
    }

})


module.exports = router
