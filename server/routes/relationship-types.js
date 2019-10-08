const express = require('express')
const router = express.Router()
const uuid4 = require('uuid/v4')
const db = require('../db.js')

// TARGETS //
router.get('/target', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.targetSpacecraftRelationshipTypes)
    res.status(200).send( result.sort((a,b) => a.order > b.order) )
})
router.post('/target', async function(req, res) {
    const toInsert = req.body
    await db.connect()
    const result = await db.insert(toInsert.map(doc => {
        if (!doc.relationshipId) doc.relationshipId = uuid4()
        return doc
    }), db.targetSpacecraftRelationshipTypes)
    res.status(201).send( result.ops )
})
router.post('/target/remove', async function(req, res) {
    await db.connect()
    const toRemove = req.body
    const result = await db.deleteOne(toRemove, db.targetSpacecraftRelationshipTypes)
    res.status(202).send( result.ops )
})

// INSTRUMENTS //
router.get('/instrument', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.instrumentSpacecraftRelationshipTypes)
    res.status(200).send( result.sort((a,b) => a.order > b.order) )
})
router.post('/instrument', async function(req, res) {
    const toInsert = req.body
    await db.connect()
    const result = await db.insert(toInsert.map(doc => {
        if (!doc.relationshipId) doc.relationshipId = uuid4()
        return doc
    }), db.instrumentSpacecraftRelationshipTypes)
    res.status(201).send( result.ops )
})
router.post('/instrument/remove', async function(req, res) {
    await db.connect()
    const toRemove = req.body
    const result = await db.deleteOne(toRemove, db.instrumentSpacecraftRelationshipTypes)
    res.status(202).send( result.ops )
})

module.exports = router;