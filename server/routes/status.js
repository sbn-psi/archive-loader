const express = require('express')
const router = express.Router()
const db = require('../db.js')

async function statusRequest(req, res, type) {
    const result = await db.find({}, type)
    res.status(200).send({
        count: result.length,
        results: result.map(item => { return { 
            name: item.display_name, 
            lid: item.logical_identifier,
            tags: item.tags
        }})
    })
}
router.get('/datasets', async function(req, res) {
    await statusRequest(req, res, db.datasets)
})
router.get('/targets', async function(req, res) {
    await statusRequest(req, res, db.targets)
})
router.get('/missions', async function(req, res) {
    await statusRequest(req, res, db.missions)
})
router.get('/spacecraft', async function(req, res) {
    await statusRequest(req, res, db.spacecraft)
})
router.get('/instruments', async function(req, res) {
    await statusRequest(req, res, db.instruments)
})

router.get('/target-relationships', async function(req, res) {
    const relationships = await db.find({}, db.targetRelationships)
    const targets = await db.find({}, db.targets)
    res.status(200).send({
        targets: targets.map(item => { return { lid: item.logical_identifier, name: item.display_name } }),
        relationships
    })
})

router.get('/tools', async function(req, res) {
    const tools = await db.find({}, db.tools)
    res.status(200).send(tools)
})

module.exports = router