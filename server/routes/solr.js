const express = require('express')
const router = express.Router()
const assert = require('assert')
const db = require('../db.js')
const solrize = require('../solrize.js')
const httpRequest = require('../httpRequest.js')
const registry = require('../registry.js')
const LID = require('../LogicalIdentifier')

const SOLR = (process.env.SOLR ? process.env.SOLR : 'http://localhost:8983/solr')
const backupCollection = 'pds'
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

// Checks integrity of both registries
function checkAvailability() {
    return new Promise(async (resolve, reject) => {
        Promise.all([
            checkSolrIntegrity(),
            checkPDSAvailability()
        ]).then(resolve, reject)
    })
}

// Checks with solr instance to ensure that there is not more than one set of collections. 
// We do this because registering too many collections with Solr can cause instability issues, and a failed sync might leave some remnants
function checkSolrIntegrity() {
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

// Checks if PDS registry is reachable and returning results
function checkPDSAvailability() {
    return new Promise(async (resolve, reject) => {
        try{ 
            let lookup = await registry.lookupIdentifiers(['urn:nasa:pds:context:instrument:ocams.orex'])
            if(!!lookup && lookup.length > 0) { resolve() } else { reject() }
        }
        catch(err) {
            console.log(err)
            reject("PDS Registry does not appear to be running")
        }
    })
}

// runs through steps to push our database into solr registry format
function sync(suffix, force) {
    return new Promise(async (resolve, reject) => {

        let completionStatus = {suffix}
    
        let successfulIndexes = await db.find({}, db.successfulIndexes)
        let previousSync = successfulIndexes.length > 0 ? successfulIndexes.last().suffix : null
    
        let bailed
        // STEP 0: Ensure clean state in Solr
        if(!force === true) {
            await checkAvailability().catch(err => {
                reject("Sync service unavailable. Please contact an administator.")
                console.log(err)
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
            reject("Error creating collections in Solr: " + err.message)
            return
        }
    
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
            reject("Error posting to collections in Solr: " + err.message)
            return
        }
    
        // STEP 3: Modify aliases
        let aliasRequests = collections.map(collection => httpRequest(`${SOLR}/admin/collections`, {
            action: 'CREATEALIAS',
            name: `${collection.collectionName}-alias`,
            collections: `${collection.collectionName}-${suffix}`
        }, null, process.env.SOLR_USER, process.env.SOLR_PASS))
        try{ await Promise.all(aliasRequests) }
        catch(err) {
            reject("Error modifying aliases in Solr: " + err.message)
            return
        }
    
        // STEP 4: Write successful sync to db
        completionStatus._timestamp = new Date()
        await db.insert([completionStatus], db.successfulIndexes)
    
        // STEP 5: Flush cache of context browser
        try {
            await httpRequest('https://sbnarchivedemo.psi.edu/urn:nasa:pds:context:investigation:mission.orex', {flush: true})
        } catch(err) {}
    
        // STEP 6: Cleanup previous sync
        try {
            await cleanup(previousSync)
        } catch (err) {
            reject("Error cleaning up previous sync: " + err)
        }
        
        resolve(completionStatus)
    })
}

// pull supplemented lids from the core registry and back them up to our solr instance
function backup(suffix) {
    const databases = [db.datasets, db.targets, db.missions, db.spacecraft, db.instruments]

    return new Promise(async (resolve, reject) => {
        let identifiers = []
        for (database of databases) {
            let newLids = await db.find({}, database, ['logical_identifier'])
            identifiers = [...identifiers, ...newLids.map(doc => new LID(doc.logical_identifier).lid)]
        }
        
        const fromRegistry = await registry.lookupIdentifiers(identifiers)

        // STEP 1: Create collection
        try {
            await httpRequest(`${SOLR}/admin/collections`, {
                action: 'CREATE',
                name: `${backupCollection}-${suffix}`,
                numShards: 1,
                ['collection.configName']: '_default'
            }, null, process.env.SOLR_USER, process.env.SOLR_PASS)
        }
        catch(err) {
            reject("Error creating collection in Solr: " + err.message)
            return
        }
    
        // STEP 2: Fill collection
        try { 
            await httpRequest(`${SOLR}/${backupCollection}-${suffix}/update`, { commit: true }, fromRegistry, process.env.SOLR_USER, process.env.SOLR_PASS)
        }
        catch(err) {
            reject("Error posting to collection in Solr: " + err.message)
            return
        }
    
        // STEP 3: Modify alias
        try{ 
            await httpRequest(`${SOLR}/admin/collections`, {
                action: 'CREATEALIAS',
                name: `${backupCollection}-alias`,
                collections: `${backupCollection}-${suffix}`
            }, null, process.env.SOLR_USER, process.env.SOLR_PASS)
        }
        catch(err) {
            reject("Error modifying alias in Solr: " + err.message)
            return
        }
    
        // delete previous collections
        const solrCollections = await httpRequest(`${SOLR}/admin/collections`, { action: 'LIST' }, null, process.env.SOLR_USER, process.env.SOLR_PASS) 
        const oldPdsCollections = solrCollections.collections.filter(collection => collection.startsWith(`${backupCollection}-`) && collection !== `${backupCollection}-${suffix}`)

        if(oldPdsCollections.length > 0) {
            let deleteRequests = oldPdsCollections.map(collection => httpRequest(`${SOLR}/admin/collections`, {
                action: 'DELETE',
                name: collection
            }, null, process.env.SOLR_USER, process.env.SOLR_PASS))
            try{ await Promise.all(deleteRequests) }
            catch(err) {
            }
        }
            
        resolve(fromRegistry.length)
    })
}

router.get('/status', async function(req, res) {
    checkAvailability().then(
        () => res.sendStatus(200),
        () => res.sendStatus(503))
})

router.post('/sync', async function(req, res){
    try {
        assert(req.body, "Couldn't parse request")
        assert(req.body.suffix, "Expected collection suffix to be specified")
    } catch(err) {
        res.status(400).send(err.message)
        return
    }

    Promise.allSettled([
        sync(req.body.suffix, req.body.force),
        backup(req.body.suffix)
    ]).then(promiseResults => {
        const [syncStatus, backupStatus] = promiseResults
        if(syncStatus.status === "fulfilled") {
            let completionStatus = syncStatus.value
            completionStatus.coreBackup = backupStatus.value || backupStatus.reason
            res.status(200).json(completionStatus)
        } else {
            res.status(500).send(syncStatus.reason)
        }
    })
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