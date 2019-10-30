const express = require('express')
const router = express.Router()
const db = require('../db.js')

router.get('/targets', async function(req, res) {
    await tagLookupRequest(req, res, db.targets)    
})
router.get('/missions', async function(req, res) {
    await tagLookupRequest(req, res, db.missions)    
})
router.get('/spacecraft', async function(req, res) {
    await tagLookupRequest(req, res, db.spacecraft)    
})
router.get('/instruments', async function(req, res) {
    await tagLookupRequest(req, res, db.instruments)    
})
router.get('/datasets', async function(req, res) {
    await tagLookupRequest(req, res, db.datasets)    
})

async function tagLookupRequest(req, res, type) {
    await db.connect()
    const result = await db.find({ "type": type }, db.tags)
    res.status(200).send( result.map(tag => tag.name) )
}

module.exports = router
