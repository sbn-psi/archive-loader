const express = require('express')
const router = express.Router()
const db = require('../db.js')
const { streamHelper, streamList, standardChunk } = require('../utils.js')

router.get('/datasets', async function(req, res) {
    let stream = streamHelper(res, standardChunk)
    db.findAndStream({}, db.datasets, stream.data, stream.end)
})
router.get('/targets', async function(req, res) {
    let stream = streamHelper(res, standardChunk)
    db.findAndStream({}, db.targets, stream.data, stream.end)
})
router.get('/instruments', async function(req, res) {
    let stream = streamHelper(res, standardChunk)
    db.findAndStream({}, db.instruments, stream.data, stream.end)
})
router.get('/missions', async function(req, res) {
    let stream = streamHelper(res, standardChunk)
    db.findAndStream({}, db.missions, stream.data, stream.end)
})
router.get('/spacecraft', async function(req, res) {
    let stream = streamHelper(res, standardChunk)
    db.findAndStream({}, db.spacecraft, stream.data, stream.end)
})
router.get('/target-relationships', async function(req, res) {
    let stream = streamHelper(res, standardChunk)
    db.findAndStream({}, db.targetRelationships, stream.data, stream.end)
})
router.get('/relationships', async function(req, res) {
    let stream = streamHelper(res, standardChunk)
    db.findAndStream({}, db.objectRelationships, stream.data, stream.end)
})

router.get('/all', async (req, res) => {
    res.set('Content-Type', 'json')
    res.write('{')
    let databases = [db.datasets, db.targets, db.missions, db.spacecraft, db.instruments, db.targetRelationships, db.targetMissionRelationshipTypes, db.instrumentSpacecraftRelationshipTypes, db.tags, db.objectRelationships, db.tools]
    let index = 0
    for (database of databases) {
        res.write(`"${database}": `)
        let listStreamer = streamList(res, standardChunk)
        await db.findAndStream({}, database, listStreamer.data, listStreamer.end)
        index++
        if(index < databases.length) { res.write(',')}
    }
    res.end('}')
})
module.exports = router