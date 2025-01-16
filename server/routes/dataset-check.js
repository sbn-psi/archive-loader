const express = require('express')
const router = express.Router()
const httpRequest = require('../httpRequest.js')
const assert = require('assert')
const { xmlParser } = require('../utils.js')

const HARVESTWRAPPER = (process.env.HARVEST ? process.env.HARVEST : 'http://localhost:3009')

const fieldMapper = dataset => { return {
    name: dataset.title,
    lidvid: dataset.lidvid,
    lid: dataset.logical_id,
    abstract: dataset.description,
    browseUrl: '',
    target_lid: dataset.target_lid,
    target_name: dataset.target_name,
    mission_lid: dataset.mission_lid,
    instrument_lid: dataset.instrument_lid
}}

router.get('/harvest', async function(req, res) {
    req.setTimeout(5 * 60 * 1000) // 5 minute timeout
    
    let bundleUrl = req.query.url;
    let discovered, parsed;
    
    try {
        assert(bundleUrl, 'No URL provided')
        assert(bundleUrl.startsWith('http'), 'URL must start with http')
        discovered = await httpRequest(HARVESTWRAPPER + '/harvest', { url: bundleUrl })
        assert(discovered.harvestOutput, 'Harvest did not return any XML')
        parsed = xmlParser.parse(discovered.harvestOutput)
        assert(parsed, 'Could not parse the harvest xml')
        assert(parsed.add, 'Harvest could not find any Bundles or Collections')
        assert(parsed.add.doc, 'Harvest could not find any Bundles or Collections')
        assert(parsed.add.doc.length > 0, 'Harvest could not find any Bundles or Collections')
        assert(parsed.add.doc[0].field, 'Harvest could not find any Bundles or Collections')
        assert(parsed.add.doc[0].field.length > 0, 'Harvest could not find any Bundles or Collections')
    } catch (err) {
        console.log(err)
        res.status(400).send(err.message)
        return
    }

    const docs = parsed.add.doc.map(doc => {
        const lid = doc.field.find(field => field['@name'] === 'lid')
        const title = doc.field.find(field => field['@name'] === 'title')
        const resource_url = doc.field.find(field => field['@name'] === 'resource_url')
        return {
            lid: lid ? lid['#text'] : '(Missing)', 
            title: title ? title['#text'] : '(Missing)',
            resource_url: resource_url ? resource_url['#text'] : '(Missing)'
        }
    })

    const response = {
        bundle: discovered.bundles.map(fieldMapper)[0],
        collections: discovered.collections.map(fieldMapper),
        harvestOutput: discovered.harvestOutput
    }

    // add the resource urls from harvest into the extracted docs
    let xmlDoc = docs.find(doc => doc.lid === response.bundle.lid)
    if(xmlDoc) response.bundle.browseUrl = xmlDoc.resource_url
    response.collections.forEach(element => {
        xmlDoc = docs.find(doc => doc.lid === element.lid)
        if(xmlDoc) element.browseUrl = xmlDoc.resource_url
    });

    res.status(200).json(response);
})

router.get('/check/bundle', async function(req, res) {
    req.setTimeout(5 * 60 * 1000) // 5 minute timeout
    
    let bundleUrl = req.query.url;
    let discovered;
    
    try {
        discovered = await httpRequest(HARVESTWRAPPER + '/extract', { url: bundleUrl })
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


router.get('/check/collection', async function(req, res) {
    req.setTimeout(5 * 60 * 1000) // 5 minute timeout
    
    let bundleUrl = req.query.url;
    let discovered;

    try {
        discovered = await httpRequest(HARVESTWRAPPER + '/extract', { url: bundleUrl })
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