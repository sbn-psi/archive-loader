const express = require('express')
const router = express.Router()
const db = require('../db.js')
const solrize = require('../solrize.js')

router.get('/datasets', async function(req, res) {
    let stream = streamHelper(res, solrizedChunk("dataset"))
    db.find({}, db.datasets, stream.data, stream.end)
})
router.get('/targets', async function(req, res) {
    let stream = streamHelper(res, standardChunk)
    db.find({}, db.targets, stream.data, stream.end)
})
router.get('/instruments', async function(req, res) {
    let stream = streamHelper(res, standardChunk)
    db.find({}, db.instruments, stream.data, stream.end)
})
router.get('/missions', async function(req, res) {
    let stream = streamHelper(res, standardChunk)
    db.find({}, db.missions, stream.data, stream.end)
})
router.get('/spacecraft', async function(req, res) {
    let stream = streamHelper(res, standardChunk)
    db.find({}, db.spacecraft, stream.data, stream.end)
})
router.get('/target-relationships', async function(req, res) {
    let stream = streamHelper(res, standardChunk)
    db.find({}, db.targetRelationships, stream.data, stream.end)
})
router.get('/relationships', async function(req, res) {
    let stream = streamHelper(res, standardChunk)
    db.find({}, db.objectRelationships, stream.data, stream.end)
})

router.get('/all', async (req, res) => {
    res.set('Content-Type', 'json')
    res.write('{')
    let databases = [db.datasets, db.targets, db.missions, db.spacecraft, db.instruments, db.targetRelationships, db.targetMissionRelationshipTypes, db.instrumentSpacecraftRelationshipTypes, db.tags, db.objectRelationships, db.tools]
    let index = 0
    for (database of databases) {
        res.write(`"${database}": `)
        let listStreamer = streamList(res, standardChunk)
        await db.find({}, database, listStreamer.data, listStreamer.end)
        index++
        if(index < databases.length) { res.write(',')}
    }
    res.end('}')
})

function standardChunk(chunk) {
    return JSON.stringify(chunk, null, "\t")
}
function solrizedChunk(attr) {
    return chunk => standardChunk(solrize(chunk, attr))
}
function streamHelper(res, chunkHandler) {
    res.set('Content-Type', 'json')
    let listStreamer = streamList(res, chunkHandler)
    return {
        data: listStreamer.data,
        end: () => {
            listStreamer.end()
            res.end()
        }
    }

}
function streamList(res, chunkHandler) {
    res.write('[')
    let prevChunk
    return {
        data: data => {
            if(prevChunk) { 
                res.write(chunkHandler(prevChunk) + ',')
            }
            prevChunk = data
        },
        end: () => {
            if(prevChunk) {
                res.write(chunkHandler(prevChunk))
            }
            res.write(']')
        }
    }
}

module.exports = router