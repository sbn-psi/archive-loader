const express = require('express')
const router = express.Router()
const db = require('../db.js')

const collections = [db.datasets, db.targets, db.missions, db.spacecraft, db.instruments, db.targetRelationships, db.targetMissionRelationshipTypes, db.instrumentSpacecraftRelationshipTypes, db.tags, db.objectRelationships, db.tools]
router.post('/fromExport', async function(req, res) {
    let data = req.body
    let promises = []
    for (let collection in data) {
        if(collections.includes(collection)) {
            if(collection === db.objectRelationships) {
                promises.push(db.insertRelationships(data[collection], collection, true))
            }
            else {
                promises.push(db.insert(data[collection], collection))
            }
        }
        else {
            console.log('skipping ' + collection)
        }
    }
    await Promise.all(promises)
    res.send('success')
})
module.exports = router