const express = require('express')
const router = express.Router()
const { v4: uuid4 } = require('uuid')
const db = require('../db.js')

// TARGETS //
router.get('/target', async function(req, res) {
    const result = await db.find({}, db.targetMissionRelationshipTypes)
    res.status(200).send( result.sort((a,b) => a.order > b.order) )
})
router.post('/target', async function(req, res) {
    const toInsert = req.body
    const result = await db.insert(toInsert.map(doc => {
        if (!doc.relationshipId) doc.relationshipId = uuid4()
        return doc
    }), db.targetMissionRelationshipTypes)
    res.status(201).send( result )
})
router.post('/target/remove', async function(req, res) {
    const toRemove = req.body
    const result = await db.deleteOne(toRemove, db.targetMissionRelationshipTypes)
    res.status(202).send( result )
})

// INSTRUMENTS //
router.get('/instrument', async function(req, res) {
    const result = await db.find({}, db.instrumentSpacecraftRelationshipTypes)
    res.status(200).send( result.sort((a,b) => a.order > b.order) )
})
router.post('/instrument', async function(req, res) {
    const toInsert = req.body
    const result = await db.insert(toInsert.map(doc => {
        if (!doc.relationshipId) doc.relationshipId = uuid4()
        return doc
    }), db.instrumentSpacecraftRelationshipTypes)
    res.status(201).send( result )
})
router.post('/instrument/remove', async function(req, res) {
    const toRemove = req.body
    const result = await db.deleteOne(toRemove, db.instrumentSpacecraftRelationshipTypes)
    res.status(202).send( result )
})

module.exports = router;