const express = require('express')
const router = express.Router()
const db = require('../db.js')

async function statusRequest(req, res, type) {
    await db.connect()
    const result = await db.find({}, type)
    res.status(200).send({
        count: result.length,
        lids: result.map(item => item.logical_identifier)
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
    await db.connect()
    const relationships = await db.find({}, db.targetRelationships)
    const targets = await db.find({}, db.targets)
    res.status(200).send({
        targets: targets.map(item => { return { lid: item.logical_identifier, name: item.display_name } }),
        relationships
    })
})

module.exports = router