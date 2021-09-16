const express = require('express')
const router = express.Router()
const db = require('../db.js')
const assert = require('assert')

router.post('/tag', async function(req, res) {
    let bailed
    let tag = req.body
    try {
        assert(tag, "Failed to parse request")
        assert(tag.name, "Missing tag name")
        assert(tag.type, "Missing tag type")

    } catch (err) {
        res.status(400).send(err)
        bailed = true
        return
    }

    if(bailed) { return }

    // insert and return
    try {
        const result = await db.insert([tag], db.tags)
        res.status(201).send(result)
    } catch(err) {
        res.status(500).send('Unexpected database error while saving')
        console.log(err);
    }

})
module.exports = router
