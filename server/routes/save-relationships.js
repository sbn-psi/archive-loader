const express = require('express')
const router = express.Router()
const db = require('../db.js')
const assert = require('assert')
const registry = require('../registry.js')

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
    let possibleFields = ['target', 'instrument_host', 'instrument', 'bundle', 'investigation']
    for(doc of objects) {
        let fieldsPresent = 0
        for(field of possibleFields) {
            if(!!doc[field]) { fieldsPresent++ }
        }
        try {
            assert(fieldsPresent === 2, `Expected ${JSON.stringify(doc)} to contain exactly two of [${possibleFields.join(', ')}]`)
            assert((doc.relationshipId || doc.label), `Expected relationshipId or label to be specified on ${JSON.stringify(doc)}`)
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
        res.status(201).send( result )
    } catch(err) {
        res.status(500).send('Unexpected database error while saving')
        console.log(err);
    }
})

router.post('/migrate-spacecraft-target-relationships', async function(req, res) {
    let existing = await db.find({}, db.objectRelationships)

    // filter for only spacecraft-target relationships
    existing = existing.filter(rel => !!rel.instrument_host && !!rel.target)

    let response = {
        modified: 0,
        ignored: []
    }

    const toAdd = await Promise.all(existing.map(async rel => {
        const missionLookup = await registry.lookupRelated(registry.type.spacecraft, registry.type.mission, rel.instrument_host)
        const mission = missionLookup && missionLookup.length >= 1 ? missionLookup[0].identifier : null

        if(!!mission) {
            response.modified += 1
            return {
                investigation: mission,
                target: rel.target,
                relationshipId: rel.relationshipId
            }
        } else {
            console.log('Could not find mission for spacecraft ' + rel.instrument_host)
            response.ignored.push(rel.instrument_host)
            return rel
        }
    }))

    try {
        const saveResponse = await db.insertRelationships(toAdd)
        response.response = saveResponse
        res.status(201).send( response )
    } catch(err) {
        response.error = err
        res.status(500).send(response)
        console.log(err);
    }
})

router.post('/migrate-spacecraft-mission-tools', async function(req, res) {
    const spacecraft = await db.find({}, db.spacecraft)

    let response = {
        modified: 0,
        ignored: []
    }

    let modified = []

    await Promise.all(spacecraft.map(async sp => {
        const missionLookup = await registry.lookupRelated(registry.type.spacecraft, registry.type.mission, sp.logical_identifier)
        const missionLid = missionLookup && missionLookup.length >= 1 ? missionLookup[0].identifier : null

        const missions = await db.find({ "logical_identifier": missionLid }, db.missions)
        let mission = missions && missions.length >= 1 ? missions[0] : null


        if(!!mission) {
            response.modified += 1
            mission.tools = sp.tools
            modified.push(mission)
        } else {
            console.log('Could not find mission for spacecraft ' + sp.logical_identifier)
            response.ignored.push(sp.logical_identifier)
        }
    }))

    try {
        const saveResponse = await db.insert(modified, db.missions)
        response.response = saveResponse
        res.status(201).send( response )
    } catch(err) {
        response.error = err
        res.status(500).send(response)
        console.log(err);
    }
})

module.exports = router