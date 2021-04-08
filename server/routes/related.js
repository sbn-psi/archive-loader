const express = require('express')
const router = express.Router()
const db = require('../db.js')
const registry = require('../registry.js')
const assert = require('assert')

router.get('/target/', async function(req, res) {
    related(registry.type.target, req, res)
})
router.get('/spacecraft/', async function(req, res) {
    related(registry.type.spacecraft, req, res)
})
router.get('/mission/', async function(req, res) {
    related(registry.type.mission, req, res)
})
router.get('/instrument/', async function(req, res) {
    related(registry.type.instrument, req, res)
})
router.get('/bundle/', async function(req, res) {
    related(registry.type.bundle, req, res)
})

const registryToFieldMap = {
    [registry.type.target]: 'target',
    [registry.type.spacecraft]: 'instrument_host',
    [registry.type.instrument]: 'instrument',
    [registry.type.bundle]: 'bundle',
    [registry.type.mission]: 'investigation'
}

async function related(desiredType, req, res) {
    let discovered
    try {
        const keys = Object.keys(req.query)
        assert(keys.length > 0, 'Expected a query parameter "spacecraft", "mission", "instrument", or "type"')
        const type = keys.first()
        assert(type, 'Expected a query parameter "spacecraft", "mission", "instrument", or "target"')
        const lid = req.query[type]
        const otherObjectDbKey = registryToFieldMap[desiredType]

        const fromRegistry = await registry.lookupRelated(type, desiredType, lid)
        const existingRelationships = await db.find({ 
                [registryToFieldMap[type]]: lid,
                [otherObjectDbKey]: { $ne: null }
            }, db.objectRelationships)
        discovered = fromRegistry.map(rel => { 
            let existing = existingRelationships.find(existing => existing[otherObjectDbKey] === rel.identifier)
            return {
                lid: rel.identifier,
                name: rel.title,
                relationshipId: existing ? existing.relationshipId : null,
                label: existing? existing.label : null
            }
        })
    } catch (err) {
        res.status(400).send(err.message)
        return
    }
    res.status(200).send(discovered)
}

module.exports = router
