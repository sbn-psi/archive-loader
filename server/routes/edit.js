const express = require('express')
const router = express.Router()
const db = require('../db.js')
const assert = require('assert')

router.get('/datasets', async function(req, res) {
    await editLookupRequest(req, res, db.datasets)    
})

router.get('/target', async function(req, res) {
    await editLookupRequest(req, res, db.targets)    
})
router.get('/mission', async function(req, res) {
    await editLookupRequest(req, res, db.missions)    
})
router.get('/spacecraft', async function(req, res) {
    await editLookupRequest(req, res, db.spacecraft)    
})
router.get('/instrument', async function(req, res) {
    await editLookupRequest(req, res, db.instruments)    
})

const dbToFieldMap = {
    [db.targets]: 'target',
    [db.spacecraft]: 'instrument_host',
    [db.instruments]: 'instrument',
}

async function editLookupRequest(req, res, type) {
    try {
        assert(req.query.logical_identifier, 'Expected logical_identifier argument')
        assert(req.query.logical_identifier.startsWith('urn:nasa:pds:'), 'Expected logical_identifier to start with urn:nasa:pds')
    } catch (err) {
        res.status(400).send(err.message)
        return
    }

    const object = await db.find({ "logical_identifier": req.query.logical_identifier }, type)
    const relationships = await db.find({ [dbToFieldMap[type]]: req.query.logical_identifier }, db.objectRelationships)
    res.status(200).send( {
        object: object[0],
        relationships: relationships
    } )
}

module.exports = router
