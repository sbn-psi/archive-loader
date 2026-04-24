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
const { config } = require('../config.js')
const { notifyArcnav } = require('../arcnav.js')
const { createSyncJob, getSyncJob, mutateSyncJob, hasActiveSyncJob } = require('../syncJobs.js')

const SOLR = config.solrUrl
const solrAuth = [config.solrUser, config.solrPass]
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
            let solrCollections = await httpRequest(`${SOLR}/admin/collections`, { action: 'LIST' }, null, ...solrAuth)
            let webCollections = solrCollections.collections.filter(collection => collection.startsWith('web-'))
            if(webCollections.length === 0 || webCollections.length === collections.length) { resolve() } else { reject() }
        }
        catch(err) {
            console.log(err)
            reject("Error fetching collections in Solr: " + err.message)
        }
    })
}

function toErrorMessage(err) {
    if(err instanceof Error) {
        return err.message
    }
    return String(err)
}

// runs through steps to push our database into solr registry format
async function sync(suffix, force, refreshMode, onProgress) {
        let completionStatus = {suffix}
    
        let successfulIndexes = await db.find({}, db.successfulIndexes, undefined, { includeTimestamp: true })
        let previousSyncRecord = successfulIndexes.length > 0 ? successfulIndexes[successfulIndexes.length - 1] : null
        let previousSync = previousSyncRecord ? previousSyncRecord.suffix : null
        let previousPublishTimestamp = previousSyncRecord?._timestamp ? new Date(previousSyncRecord._timestamp) : null

        onProgress?.({
            step: 'Checking Solr availability',
            message: 'Ensuring the publish target is ready.'
        })

        // STEP 0: Ensure clean state in Solr
        if(force !== true) {
            try {
                await checkAvailability()
            } catch(err) {
                console.error('[sync] availability check failed:', err)
                throw new Error("Sync service unavailable. Please contact an administator.")
            }
        }
    
        onProgress?.({
            step: 'Creating Solr collections',
            message: 'Preparing new Solr collections for this publish.',
            publishProgress: {
                totalCollections: collections.length,
                completedCollections: 0,
                currentCollection: null
            }
        })

        // STEP 1: Create collections
        let createRequests = collections.map(collection => httpRequest(`${SOLR}/admin/collections`, {
            action: 'CREATE',
            name: `${collection.collectionName}-${suffix}`,
            numShards: 1,
            ['collection.configName']: collection.config ? collection.config : '_default'
        }, null, ...solrAuth))
        try{ await Promise.all(createRequests) }
        catch(err) {
            throw new Error("Error creating collections in Solr: " + err.message)
        }

        onProgress?.({
            step: 'Uploading publish data',
            message: 'Sending current Archive Loader records to Solr.',
            publishProgress: {
                totalCollections: collections.length,
                completedCollections: 0,
                currentCollection: null
            }
        })

        // Capture the DB-snapshot instant BEFORE any reads for this publish. This
        // becomes both (a) the upper bound of the incremental revalidate diff and
        // (b) the stored _timestamp that the NEXT publish resumes from. Anything
        // saved after this instant is deliberately deferred to the next run, so
        // we never tell Archive Navigator to revalidate a record whose Solr copy
        // is still stale.
        const publishSnapshotInstant = new Date()

        // STEP 2: Fill collections
        let completedCollections = 0
        let fillRequests = collections.map(async (collection) => {
            let documents = await db.find({}, collection.dbName)
            completionStatus[collection.dbName] = documents.length
            onProgress?.({
                step: 'Uploading publish data',
                message: `Uploading ${collection.collectionName}.`,
                publishProgress: {
                    totalCollections: collections.length,
                    completedCollections,
                    currentCollection: collection.collectionName
                }
            })
            await httpRequest(`${SOLR}/${collection.collectionName}-${suffix}/update`, { commit: true }, collection.solrize ? solrize(documents, collection.solrizeAttr) : documents, ...solrAuth)
            completedCollections += 1
            onProgress?.({
                step: 'Uploading publish data',
                message: `Uploaded ${completedCollections} of ${collections.length} Solr collections.`,
                publishProgress: {
                    totalCollections: collections.length,
                    completedCollections,
                    currentCollection: completedCollections < collections.length ? collection.collectionName : null
                }
            })
        })
        try { 
            await Promise.all(fillRequests)
        }
        catch(err) {
            throw new Error("Error posting to collections in Solr: " + err.message)
        }

        onProgress?.({
            step: 'Switching Solr aliases',
            message: 'Activating the new Solr collections.',
            publishProgress: {
                totalCollections: collections.length,
                completedCollections: collections.length,
                currentCollection: null
            }
        })

        // STEP 3: Modify aliases
        let aliasRequests = collections.map(collection => httpRequest(`${SOLR}/admin/collections`, {
            action: 'CREATEALIAS',
            name: `${collection.collectionName}-alias`,
            collections: `${collection.collectionName}-${suffix}`
        }, null, ...solrAuth))
        try{ await Promise.all(aliasRequests) }
        catch(err) {
            throw new Error("Error modifying aliases in Solr: " + err.message)
        }

        onProgress?.({
            step: 'Recording publish',
            message: 'Saving this publish as the latest successful run.',
            publishProgress: {
                totalCollections: collections.length,
                completedCollections: collections.length,
                currentCollection: null
            }
        })

        // STEP 4: Write successful sync to db
        // Use the pre-upload snapshot instant so the next publish's incremental
        // diff resumes from exactly the point captured in Solr.
        completionStatus._timestamp = publishSnapshotInstant
        await db.insert([completionStatus], db.successfulIndexes)

        onProgress?.({
            step: 'Updating Archive Navigator',
            message: refreshMode === 'full' ? 'Starting a full Archive Navigator refresh after the publish.' : 'Refreshing Archive Navigator after the publish.',
            arcnav: {
                refreshMode,
                changedIdentifiers: 0,
                liveFlush: {
                    status: 'running',
                    message: 'Refreshing Archive Navigator cache.'
                },
                revalidate: {
                    mode: refreshMode,
                    status: 'pending',
                    total: 0,
                    completed: 0,
                    failed: 0,
                    currentIdentifier: null,
                    remoteJobId: null,
                    message: refreshMode === 'full'
                        ? 'Starting a full Archive Navigator refresh job. This can take several minutes.'
                        : 'Calculating which records changed since the last publish.',
                    failures: []
                }
            }
        })

        // STEP 5: Notify Archive Navigator.
        // Bound the incremental diff to `(previousPublishTimestamp, publishSnapshotInstant]`:
        //   - `since` skips records already covered by prior publishes.
        //   - `until` excludes anything written after our DB snapshot, which is
        //     therefore NOT in the Solr collections we just uploaded. Those
        //     records will have _timestamp > publishSnapshotInstant and will be
        //     picked up by the next publish's diff automatically.
        const arcnav = await notifyArcnav({
            since: previousPublishTimestamp,
            until: publishSnapshotInstant,
            mode: refreshMode,
            onLiveFlushProgress: (liveFlush) => {
                onProgress?.({
                    step: 'Updating Archive Navigator',
                    message: liveFlush.message,
                    arcnav: { liveFlush }
                })
            },
            onRevalidateProgress: (revalidate) => {
                onProgress?.({
                    step: 'Updating Archive Navigator',
                    message: revalidate.message,
                    arcnav: { revalidate }
                })
            }
        })

        onProgress?.({
            step: 'Updating Archive Navigator',
            message: arcnav.revalidate.message,
            arcnav: {
                refreshMode,
                changedIdentifiers: arcnav.changedIdentifiers.length,
                liveFlush: arcnav.liveFlush,
                revalidate: arcnav.revalidate
            }
        })

        onProgress?.({
            step: previousSync ? 'Cleaning up previous publish' : 'Finishing publish',
            message: previousSync ? 'Removing the previous Solr collections.' : 'No previous publish collections need cleanup.'
        })
    
        // STEP 6: Cleanup previous sync
        if(previousSync) {
            try {
                await cleanup(previousSync)
            } catch (err) {
                throw new Error("Error cleaning up previous sync: " + err)
            }
        }

        completionStatus.arcnav = {
            refreshMode,
            changedIdentifiers: arcnav.changedIdentifiers.length,
            liveFlush: arcnav.liveFlush.status,
            revalidate: {
                mode: arcnav.revalidate.mode,
                total: arcnav.revalidate.total,
                completed: arcnav.revalidate.completed,
                failed: arcnav.revalidate.failed,
                status: arcnav.revalidate.status,
                remoteJobId: arcnav.revalidate.remoteJobId
            }
        }

        return {
            ...completionStatus,
            arcnav: {
                refreshMode,
                changedIdentifiers: arcnav.changedIdentifiers.length,
                liveFlush: arcnav.liveFlush,
                revalidate: arcnav.revalidate
            }
        }
}

async function runSyncJob(jobId, suffix, force, refreshMode) {
    mutateSyncJob(jobId, (job) => {
        job.status = 'running'
        job.step = 'Starting publish'
        job.message = 'Preparing publish.'
        job.startedAt = new Date().toISOString()
        job.publishProgress.totalCollections = collections.length
        job.arcnav.refreshMode = refreshMode
        job.arcnav.revalidate.mode = refreshMode
    })

    try {
        const result = await sync(suffix, force, refreshMode, (progress) => {
            mutateSyncJob(jobId, (job) => {
                if(progress.step) {
                    job.step = progress.step
                }
                if(progress.message) {
                    job.message = progress.message
                }
                if(progress.publishProgress) {
                    job.publishProgress = {
                        ...job.publishProgress,
                        ...progress.publishProgress
                    }
                }
                if(progress.arcnav) {
                    job.arcnav = {
                        ...job.arcnav,
                        ...progress.arcnav,
                        liveFlush: {
                            ...job.arcnav.liveFlush,
                            ...(progress.arcnav.liveFlush || {})
                        },
                        revalidate: {
                            ...job.arcnav.revalidate,
                            ...(progress.arcnav.revalidate || {})
                        }
                    }
                }
            })
        })

        mutateSyncJob(jobId, (job) => {
            const incrementalFailures = result.arcnav?.revalidate?.failed || 0
            const flushFailed = result.arcnav?.liveFlush?.status === 'failed'
            job.status = 'completed'
            job.step = incrementalFailures > 0 || flushFailed ? 'Publish completed with refresh issues' : 'Publish complete'
            job.message = incrementalFailures > 0 || flushFailed
                ? 'Publish completed, but Archive Navigator refresh reported issues.'
                : 'Publish completed successfully.'
            job.finishedAt = new Date().toISOString()
            job.result = result
            job.arcnav.refreshMode = result.arcnav?.refreshMode || job.arcnav.refreshMode
            job.arcnav.changedIdentifiers = result.arcnav?.changedIdentifiers || 0
            job.arcnav.liveFlush = result.arcnav?.liveFlush || job.arcnav.liveFlush
            job.arcnav.revalidate = result.arcnav?.revalidate || job.arcnav.revalidate
        })
    } catch(err) {
        const errorMessage = toErrorMessage(err)
        mutateSyncJob(jobId, (job) => {
            job.status = 'failed'
            job.step = 'Publish failed'
            job.message = errorMessage
            job.error = errorMessage
            job.finishedAt = new Date().toISOString()
        })
    }
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
            }, null, ...solrAuth)
        }
        catch(err) {
            reject("Error creating collection in Solr: " + err.message)
            return
        }
    
        // STEP 2: Fill collection
        try { 
            await httpRequest(`${SOLR}/${contextCollection}-${suffix}/update`, { commit: true }, fromRegistry, ...solrAuth)
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
            }, null, ...solrAuth)
        }
        catch(err) {
            reject("Error modifying alias in Solr: " + err.message)
            return
        }
    
        // delete previous collections
        const solrCollections = await httpRequest(`${SOLR}/admin/collections`, { action: 'LIST' }, null, ...solrAuth)
        const oldPdsCollections = solrCollections.collections.filter(collection => collection.startsWith(`${contextCollection}-`) && collection !== `${contextCollection}-${suffix}`)

        if(oldPdsCollections.length > 0) {
            let deleteRequests = oldPdsCollections.map(collection => httpRequest(`${SOLR}/admin/collections`, {
                action: 'DELETE',
                name: collection
            }, null, ...solrAuth))
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

    // Prevent overlapping publishes - they would race on Solr collection
    // creation with the same suffix and corrupt the alias switch.
    if(hasActiveSyncJob()) {
        res.status(409).send('A publish is already in progress. Wait for it to finish before starting another.')
        return
    }

    const refreshMode = req.body.fullReload === true ? 'full' : 'incremental'
    const job = createSyncJob({ suffix: req.body.suffix, refreshMode })
    void runSyncJob(job.id, req.body.suffix, req.body.force, refreshMode)
    res.status(202).json(job)
})

router.get('/sync/:jobId', async function(req, res) {
    const job = getSyncJob(req.params.jobId)
    if(!job) {
        res.status(404).send('Publish job not found')
        return
    }
    res.status(200).json(job)
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
    let defaultSuffix = new Date().toISOString().slice(0,-14).replace(/-/g, '')
    let defaultIndex = 0
    if(latest.length === 0) { 
        res.status(200).send(defaultSuffix + defaultIndex)
        return
    }
    latest = latest[latest.length - 1]
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
    res.status(200).json(successfulIndexes.length > 0 ? successfulIndexes[successfulIndexes.length - 1] : {})
})

function cleanup(suffix) {
    return new Promise(async (resolve, reject) => {
        if(!suffix) {
            resolve()
            return
        }
        
        let deleteRequests = collections.map(collection => httpRequest(`${SOLR}/admin/collections`, {
            action: 'DELETE',
            name: `${collection.collectionName}-${suffix}`
        }, null, ...solrAuth))
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
            username: config.solrUser || undefined,
            password: config.solrPass || undefined
        })
        res.status(200).send(response.body)
    } catch(err) {
        res.status(500).send(err.message)
    }  
})

module.exports = router
