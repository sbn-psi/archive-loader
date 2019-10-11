const express = require('express')
const router = express.Router()
const db = require('../db.js')
const solrize = require('../solrize.js')

router.get('/datasets', async function(req, res) {
    await db.connect()
    let stream = streamHelper(req, res, solrizedChunk("dataset"))
    db.find({}, db.datasets, stream.data, stream.end)
})
router.get('/targets', async function(req, res) {
    await db.connect()
    let stream = streamHelper(req, res, standardChunk)
    db.find({}, db.targets, stream.data, stream.end)
})
router.get('/instruments', async function(req, res) {
    await db.connect()
    let stream = streamHelper(req, res, standardChunk)
    db.find({}, db.instruments, stream.data, stream.end)
})
router.get('/missions', async function(req, res) {
    await db.connect()
    let stream = streamHelper(req, res, standardChunk)
    db.find({}, db.missions, stream.data, stream.end)
})
router.get('/spacecraft', async function(req, res) {
    await db.connect()
    let stream = streamHelper(req, res, standardChunk)
    db.find({}, db.spacecraft, stream.data, stream.end)
})
router.get('/target-relationships', async function(req, res) {
    await db.connect()
    let stream = streamHelper(req, res, standardChunk)
    db.find({}, db.targetRelationships, stream.data, stream.end)
})
router.get('/relationships', async function(req, res) {
    await db.connect()
    let stream = streamHelper(req, res, standardChunk)
    db.find({}, db.objectRelationships, stream.data, stream.end)
})

function standardChunk(chunk) {
    return JSON.stringify(chunk)
}
function solrizedChunk(attr) {
    return chunk => standardChunk(solrize(chunk, attr))
}
function streamHelper(req, res, chunkHandler) {
    res.set('Content-Type', 'json')
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
            res.end(']')
        }
    }
}

module.exports = router