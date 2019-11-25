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
    const instruments = await db.join(db.instruments, db.objectRelationships, 'logical_identifier', 'instrument', 'relationships')
    res.status(200).send({
        count: instruments.length,
        results: instruments.map(instrument => { 
            const relationship = instrument.relationships.find(rel => !!rel.instrument_host)
            return { 
                name: instrument.display_name, 
                lid: instrument.logical_identifier,
                tags: instrument.tags,
                spacecraft: relationship ? relationship.instrument_host : null
            }
        })
    })
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

router.get('/relationships', async function(req, res) {
    const tools = await db.find({}, db.objectRelationships)
    res.status(200).send(tools)
})

module.exports = router