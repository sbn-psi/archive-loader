const express = require('express')
const router = express.Router()
const assert = require('assert')
const db = require('../db.js')
const solrize = require('../solrize.js')
const httpRequest = require('../httpRequest.js')

const SOLR = (process.env.SOLR ? process.env.SOLR : 'http://localhost:8983/solr')

const collections = [{
    dbName: db.datasets,
    collectionName: 'web-datasets',
    solrize: true,
    config: 'sbn'
},{
    dbName: db.targets,
    collectionName: 'web-targets'
},{
    dbName: db.missions,
    collectionName: 'web-investigations'
},{
    dbName: db.spacecraft,
    collectionName: 'web-instrumenthosts'
},{
    dbName: db.instruments,
    collectionName: 'web-instruments'
},{
    dbName: db.targetRelationships,
    collectionName: 'web-targetrelationships'
},{
    dbName: db.tags,
    collectionName: 'web-tags'
},{
    dbName: db.objectRelationships,
    collectionName: 'web-objectrelationships'
},{
    dbName: db.targetSpacecraftRelationshipTypes,
    collectionName: 'web-targetspacecraftrelationshiptypes'
},{
    dbName: db.instrumentSpacecraftRelationshipTypes,
    collectionName: 'web-instrumentspacecraftrelationshiptypes'
}]

router.post('/sync', async function(req, res){
    let bailed = false
    try {
        assert(req.body, "Couldn't parse request")
        assert(req.body.suffix, "Expected collection suffix to be specified")
    } catch(err) {
        res.status(400).send(err.message)
        bailed = true
    }
    if(bailed) {return}

    let suffix = req.body.suffix
    let completionStatus = {suffix}
    await db.connect()

    // STEP 1: Create collections
    let createRequests = collections.map(collection => httpRequest(`${SOLR}/admin/collections`, {
        action: 'CREATE',
        name: `${collection.collectionName}-${suffix}`,
        numShards: 1,
        ['collection.configName']: collection.config ? collection.config : '_default'
    }))
    try{ await Promise.all(createRequests) }
    catch(err) {
        res.status(400).send("Error creating collections in Solr: " + err.message)
        bailed = true
    }
    if(bailed) {return}

    // STEP 2: Fill collections
    let fillRequests = []
    for (collection of collections) {
        let documents = await db.find({}, collection.dbName)
        completionStatus[collection.dbName] = documents.length
        let request = httpRequest(`${SOLR}/${collection.collectionName}-${suffix}/update`, { commit: true }, collection.solrize ? solrize(documents) : documents)
        fillRequests.push(request)
    }
    try { 
        await Promise.all(fillRequests)
    }
    catch(err) {
        res.status(400).send("Error posting to collections in Solr: " + err.message)
        bailed = true
    }
    if(bailed) {return}

    // STEP 3: Modify aliases
    let aliasRequests = collections.map(collection => httpRequest(`${SOLR}/admin/collections`, {
        action: 'CREATEALIAS',
        name: `${collection.collectionName}-alias`,
        collections: `${collection.collectionName}-${suffix}`
    }))
    try{ await Promise.all(aliasRequests) }
    catch(err) {
        res.status(400).send("Error modifying aliases in Solr: " + err.message)
        bailed = true
    }
    if(bailed) {return}

    completionStatus._timestamp = new Date()
    await db.insert([completionStatus], db.successfulIndexes)
    res.status(200).json(completionStatus)
})

router.get('/suffix-suggestion', async (req, res) => {
    await db.connect()
    let latest = await db.find({}, db.successfulIndexes)
    let defaultSuffix = new Date().toISOString().slice(0,-14).replaceAll('-','')
    let defaultIndex = 0
    if(latest.length === 0) { 
        res.status(200).send(defaultSuffix + defaultIndex)
        return
    }
    latest = latest.last()
    let lastSuffix = latest.suffix
    let lastIndex = latest.suffix.charAt(latest.suffix.length-1)
    if(lastSuffix === (defaultSuffix + lastIndex)) {
        res.status(200).send(defaultSuffix + (parseInt(lastIndex) + 1))
    } else {
        res.status(200).send(defaultSuffix + defaultIndex)
    }
})

router.get('/last-index', async (req, res) => {
    await db.connect()
    let successfulIndexes = await db.find({}, db.successfulIndexes)
    res.status(200).json(successfulIndexes.length > 0 ? successfulIndexes.last() : {})
})

module.exports = router