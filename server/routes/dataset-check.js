const express = require('express')
const router = express.Router()
const httpRequest = require('./httpRequest.js')
const assert = require('assert')

const HARVESTWRAPPER = (process.env.HARVEST ? process.env.HARVEST : 'http://localhost:3009') + '/extract'

const fieldMapper = dataset => { return {
    name: dataset.title,
    lidvid: dataset.lidvid,
    abstract: dataset.description,
    browseUrl: '',
    target_lid: dataset.target_lid,
    target_name: dataset.target_name,
    mission_lid: dataset.mission_lid,
    instrument_lid: dataset.instrument_lid
}}
router.get('/bundle', async function(req, res) {
    let bundleUrl = req.query.url;
    let discovered;
    
    try {
        discovered = await httpRequest(HARVESTWRAPPER, { url: bundleUrl })
        assert(discovered.bundles, 'Could not find any bundles at that URL')
        assert(discovered.bundles.length > 0, 'Could not find any bundles at that URL')
        assert(discovered.collections, 'Could not find any collections at that URL')
        assert(discovered.collections.length > 0, 'Could not find any collections at that URL')
    } catch (err) {
        res.status(400).send(err.message)
        return
    }

    const response = {
        bundle: discovered.bundles.map(fieldMapper)[0],
        collections: discovered.collections.map(fieldMapper)
    }
    res.status(200).send(response);
})


router.get('/collection', async function(req, res) {
    
    let bundleUrl = req.query.url;
    let discovered;

    try {
        discovered = await httpRequest(HARVESTWRAPPER, { url: bundleUrl })
        assert(discovered.collections, 'Could not find any collections at that URL')
        assert(discovered.collections.length > 0, 'Could not find any collections at that URL')
    } catch (err) {
        res.status(400).send(err.message)
        return
    }

    const response = {
        collections: discovered.collections.map(fieldMapper)
    }
    res.status(200).send(response);
})

module.exports = router