const express = require('express')
const router = express.Router()
const assert = require('assert')
const db = require('../db.js')
const solrize = require('../solrize.js')
const httpRequest = require('../httpRequest.js')
const registry = require('../registry.js')
const LID = require('../LogicalIdentifier')
const got = require('got')
const { xmlParser } = require('../utils.js')

const SOLR = (process.env.SOLR ? process.env.SOLR : 'http://localhost:8983/solr')
const pdsCollectionAlias = 'pds' // alias of both context and dataset collections
const contextCollection = 'pds-context' // will be suffixed, gets replaced every time
const datasetCollection = 'pds-dataset' // will NOT be suffixed, stays persistent
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
            await got('https://arcnav.psi.edu/urn:nasa:pds:context:investigation:mission.orex', {
                searchParams: {
                    flush: true
                }
            });
        } catch(err) {
            console.log(err)
            // don't reject if this fails
        }
    
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
function backup(suffix, ignoreBackup) {
    const databases = [db.targets, db.missions, db.spacecraft, db.instruments]

    if(ignoreBackup) { return Promise.resolve(0) }

    return new Promise(async (resolve, reject) => {
        let identifiers = []
        for (database of databases) {
            let newLids = await db.find({}, database, ['logical_identifier'])
            identifiers = [...identifiers, ...newLids.map(doc => new LID(doc.logical_identifier).lid)]
        }
        
        let fromRegistry = await registry.lookupIdentifiers(identifiers)
        fromRegistry.forEach( doc => {
            delete doc.score
            if(!doc.lid) {
                doc.lid = doc.identifier   
            }
            if(!doc.package_id) {
                doc.package_id = suffix
            }
        })

        // STEP 1: Create collection
        try {
            await httpRequest(`${SOLR}/admin/collections`, {
                action: 'CREATE',
                name: `${contextCollection}-${suffix}`,
                numShards: 1,
                ['collection.configName']: 'data'
            }, null, process.env.SOLR_USER, process.env.SOLR_PASS)
        }
        catch(err) {
            reject("Error creating collection in Solr: " + err.message)
            return
        }
    
        // STEP 2: Fill collection
        try { 
            await httpRequest(`${SOLR}/${contextCollection}-${suffix}/update`, { commit: true }, fromRegistry, process.env.SOLR_USER, process.env.SOLR_PASS)
        }
        catch(err) {
            reject("Error posting to collection in Solr: " + err.message)
            return
        }
    
        // STEP 3: Modify alias
        try{ 
            await httpRequest(`${SOLR}/admin/collections`, {
                action: 'CREATEALIAS',
                name: `${pdsCollectionAlias}-alias`,
                collections: `${contextCollection}-${suffix},${datasetCollection}`
            }, null, process.env.SOLR_USER, process.env.SOLR_PASS)
        }
        catch(err) {
            reject("Error modifying alias in Solr: " + err.message)
            return
        }
    
        // delete previous collections
        const solrCollections = await httpRequest(`${SOLR}/admin/collections`, { action: 'LIST' }, null, process.env.SOLR_USER, process.env.SOLR_PASS) 
        const oldPdsCollections = solrCollections.collections.filter(collection => collection.startsWith(`${contextCollection}-`) && collection !== `${contextCollection}-${suffix}`)

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

    // we don't want to do backups every time now
    /*
    Promise.allSettled([
        sync(req.body.suffix, req.body.force),
        backup(req.body.suffix, req.body.ignoreBackup)
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
    */

    sync(req.body.suffix, req.body.force).then(
        completionStatus => res.status(200).json(completionStatus),
        err => res.status(500).send(err)
    )
})

router.get('/fetchbackup', async function(req, res){
    const databases = [db.targets, db.missions, db.spacecraft, db.instruments]
    let identifiers = []
    for (database of databases) {
        let newLids = await db.find({}, database, ['logical_identifier'])
        identifiers = [...identifiers, ...newLids.map(doc => new LID(doc.logical_identifier).lid)]
    }
    let fromRegistry = await registry.lookupIdentifiers(identifiers)
    fromRegistry.forEach( doc => {
        delete doc.score
        if(!doc.lid)
        {
            doc.lid = doc.identifier   
        }
        if(!doc.package_id) {
            doc.package_id = 'sbn'
        }
    })
    res.status(200).json(fromRegistry)
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

router.post('/harvest', async (req, res) => {
    try {
        assert(req.body.xml, "Expected XML to be specified")
        let parsed = xmlParser.parse(req.body.xml)
        assert(parsed, 'Could not parse the harvest xml')
        assert(parsed.add, 'Harvest could not find any Bundles or Collections')
        assert(parsed.add.doc, 'Harvest could not find any Bundles or Collections')
        assert(parsed.add.doc.length > 0, 'Harvest could not find any Bundles or Collections')
        assert(parsed.add.doc[0].field, 'Harvest could not find any Bundles or Collections')
        assert(parsed.add.doc[0].field.length > 0, 'Harvest could not find any Bundles or Collections')
    } catch(err) {
        res.status(400).send(err.message)
        return
    }

    // make a got request with the xml body to the solr instance
    try {
        let response = await got.post(`${SOLR}/${datasetCollection}/update/xslt?tr=add-hierarchy.xsl&commit=true`, {
            body: req.body.xml,
            headers: {
                'Content-Type': 'application/xml'
            },
            username: process.env.SOLR_USER,
            password: process.env.SOLR_PASS
        })
        res.status(200).send(response.body)
    } catch(err) {
        res.status(500).send(err.message)
    }  
})

module.exports = router