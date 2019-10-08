const express = require('express')
const router = express.Router()
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
async function related(desiredType, req, res) {
    let discovered
    try {
        // assert(req.query.length > 0, 'Expected a query parameter "spacecraft", "mission", "instrument", or "type"')
        let type = Object.keys(req.query).first()
        assert(type, 'Expected a query parameter "spacecraft", "mission", "instrument", or "target"')
        let lid = req.query[type]
        
        discovered = await registry.lookupRelated(type, desiredType, lid)
    } catch (err) {
        res.status(400).send(err.message)
        return
    }
    res.status(200).send(discovered)
}

module.exports = router
