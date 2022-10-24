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


router.delete('/tag/:type/:name', async function(req, res) {
    const {name, type} = req.params
    try {
        assert(type, 'Missing target type')
        assert(name, 'Missing target name')
    } catch (err) {
        res.status(400).send(err.message)
        return
    }

    try {
        let owners = await db.find({tags: name}, type) 
        let updateReq = null
        if(owners?.length > 0) {
            owners.forEach(doc => {
                doc.tags = doc.tags.filter(tag => tag != name)
            })
            updateReq = await db.insert(owners, type)
        }
        const deleteReq = await db.deleteOne({ name, type }, db.tags)
    
        // ALSO I NEED TO DELETE THE TAG FROM THE THING
        res.status(200).send( {
            updateReq: updateReq , deleteReq
        } )
    } catch(err) {
        res.status(500).send("Unexpected database error deleting tag")
        console.log(err)
    }
})

module.exports = router
