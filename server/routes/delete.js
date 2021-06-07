const express = require('express')
const router = express.Router()
const db = require('../db.js')
const assert = require('assert')

router.delete('/dataset/:lid', async function(req, res) {
    await deleteRequest(req, res, db.datasets)    
})

router.delete('/target/:lid', async function(req, res) {
    await deleteRequest(req, res, db.targets)    
})
router.delete('/mission/:lid', async function(req, res) {
    await deleteRequest(req, res, db.missions)    
})
router.delete('/spacecraft/:lid', async function(req, res) {
    await deleteRequest(req, res, db.spacecraft)    
})
router.delete('/instrument/:lid', async function(req, res) {
    await deleteRequest(req, res, db.instruments)    
})

async function deleteRequest(req, res, type) {
    try {
        assert(req.params.lid, 'Invalid delete request')
        assert(req.params.lid.startsWith('urn'), 'Invalid lid ' + req.params.lid)
    } catch (err) {
        res.status(400).send(err.message)
        return
    }

    const object = await db.deleteOne({ "logical_identifier": req.params.lid }, type)
    res.status(200).send( {
        object: object,
    } )
}

module.exports = router
