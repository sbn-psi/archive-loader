const express = require('express')
const router = express.Router()
const db = require('../db.js')
const solrize = require('../solrize.js')

router.get('/datasets', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.datasets)
    res.status(200).send( solrize(result, "dataset") )
})
router.get('/targets', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.targets)
    res.status(200).send( result )
})
router.get('/instruments', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.instruments)
    res.status(200).send( result )
})
router.get('/missions', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.missions)
    res.status(200).send( result )
})
router.get('/spacecraft', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.spacecraft)
    res.status(200).send( result )
})
router.get('/target-relationships', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.targetRelationships)
    res.status(200).send( result )
})
router.get('/relationships', async function(req, res) {
    await db.connect()
    const result = await db.find({}, db.objectRelationships)
    res.status(200).send( result )
})

module.exports = router