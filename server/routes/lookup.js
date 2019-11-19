const express = require('express')
const router = express.Router()
const registry = require('../registry.js')
const assert = require('assert')

router.get('/', async function(req, res) {
    let lid = req.query.lid;
    let fields = req.query.fields
    let discovered;

    try {
        assert(lid, 'Expected lid parameter')
        discovered = await registry.contextObjectLookupRequest(lid, fields)
    } catch (err) {
        res.status(400).send(err.message)
        return
    }
    res.status(200).send(discovered);
})

module.exports = router
