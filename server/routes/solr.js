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
    solrizeAttr: 'dataset'
},{
    dbName: db.targets,
    collectionName: 'web-targets',
    solrize: true,
    solrizeAttr: 'target',
},{
    dbName: db.missions,
    collectionName: 'web-investigations',
    solrize: true,
    solrizeAttr: 'mission',
},{
    dbName: db.spacecraft,
    collectionName: 'web-instrumenthosts',
    solrize: true,
    solrizeAttr: 'spacecraft',
},{
    dbName: db.instruments,
    collectionName: 'web-instruments',
    solrize: true,
    solrizeAttr: 'instrument',
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
    dbName: db.targetMissionRelationshipTypes,
    collectionName: 'web-targetmissionrelationshiptypes'
},{
    dbName: db.targetMissionRelationshipTypes, // sync this db to the old collection as well, during migration
    collectionName: 'web-targetspacecraftrelationshiptypes'
},{
    dbName: db.instrumentSpacecraftRelationshipTypes,
    collectionName: 'web-instrumentspacecraftrelationshiptypes'
},{
    dbName: db.tools,
    collectionName: 'web-tools'
}]

// Checks with solr instance to ensure that there is not more than one set of collections. 
// We do this because registering too many collections with Solr can cause instability issues, and a failed sync might leave some remnants
function checkAvailability() {
    return new Promise(async (resolve, reject) => {
        try{ 
            let solrCollections = await httpRequest(`${SOLR}/admin/collections`, { action: 'LIST' }, null, process.env.SOLR_USER, process.env.SOLR_PASS) 
            let webCollections = solrCollections.collections.filter(collection => collection.startsWith('web-'))
            if(webCollections.length === 0 || webCollections.length === collections.length) { resolve() } else { reject() }
        }
        catch(err) {
            console.log(err)
            reject("Error fetching collections in Solr: " + err.message)
        }
    })
}

router.get('/status', async function(req, res) {
    checkAvailability().then(
        () => res.sendStatus(200),
        () => res.sendStatus(503))
})

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

    let successfulIndexes = await db.find({}, db.successfulIndexes)
    let previousSync = successfulIndexes.length > 0 ? successfulIndexes.last().suffix : null

    // STEP 0: Ensure clean state in Solr
    if(!req.body.force === true) {
        await checkAvailability().catch(err => {
            console.log(err)
            res.status(500).send("Sync service unavailable. Please contact an administator.")
            bailed = true
        })
    }

    if(bailed) {return}

    // STEP 1: Create collections
    let createRequests = collections.map(collection => httpRequest(`${SOLR}/admin/collections`, {
        action: 'CREATE',
        name: `${collection.collectionName}-${suffix}`,
        numShards: 1,
        ['collection.configName']: collection.config ? collection.config : '_default'
    }, null, process.env.SOLR_USER, process.env.SOLR_PASS))
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
        let request = httpRequest(`${SOLR}/${collection.collectionName}-${suffix}/update`, { commit: true }, collection.solrize ? solrize(documents, collection.solrizeAttr) : documents, process.env.SOLR_USER, process.env.SOLR_PASS)
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
    }, null, process.env.SOLR_USER, process.env.SOLR_PASS))
    try{ await Promise.all(aliasRequests) }
    catch(err) {
        res.status(400).send("Error modifying aliases in Solr: " + err.message)
        bailed = true
    }
    if(bailed) {return}

    // STEP 4: Write successful sync to db
    completionStatus._timestamp = new Date()
    await db.insert([completionStatus], db.successfulIndexes)

    // STEP 4: Cleanup previous sync
    try {
        await cleanup(previousSync)
        res.status(200).json(completionStatus)
    } catch (err) {
        res.status(500).send("Error cleaning up previous sync: " + err)
    }
})

router.get('/suffix-suggestion', async (req, res) => {
    let latest = await db.find({}, db.successfulIndexes)
    let defaultSuffix = new Date().toISOString().slice(0,-14).replaceAll('-','')
    let defaultIndex = 0
    if(latest.length === 0) { 
        res.status(200).send(defaultSuffix + defaultIndex)
        return
    }
    latest = latest.last()
    let lastSuffix = latest.suffix
    
    let lastIndex = lastSuffix.slice(defaultSuffix.length)
    if(lastSuffix === (defaultSuffix + lastIndex)) {
        res.status(200).send(defaultSuffix + (parseInt(lastIndex) + 1))
    } else {
        res.status(200).send(defaultSuffix + defaultIndex)
    }
})

router.get('/last-index', async (req, res) => {
    let successfulIndexes = await db.find({}, db.successfulIndexes)
    res.status(200).json(successfulIndexes.length > 0 ? successfulIndexes.last() : {})
})

function cleanup(suffix) {
    return new Promise(async (resolve, reject) => {
        
        let deleteRequests = collections.map(collection => httpRequest(`${SOLR}/admin/collections`, {
            action: 'DELETE',
            name: `${collection.collectionName}-${suffix}`
        }, null, process.env.SOLR_USER, process.env.SOLR_PASS))
        try{ await Promise.all(deleteRequests) }
        catch(err) {
            reject("Error deleting collections in Solr: " + err.message)
            return
        }
        resolve()
    })
}

router.delete('/cleanup/:suffix', async (req, res) => {
    let bailed = false
    try {
        assert(req.params.suffix, "Expected collection suffix to be specified")
    } catch(err) {
        res.status(400).send(err.message)
        bailed = true
    }
    if(bailed) {return}

    cleanup(req.params.suffix).then(() => res.sendStatus(204), err => res.status(500).send(err))
})

module.exports = router