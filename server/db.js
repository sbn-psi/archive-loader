const { config } = require('./config.js')
const url = config.mongoUrl
const APP_NAME = 'app'
const assert = require('assert')

const {MongoClient} = require('mongodb')

const datasetsCollection = 'datasets'
const targetsCollection = 'targets'
const missionsCollection = 'missions'
const spacecraftCollection = 'spacecraft'
const instrumentsCollection = 'instruments'
const targetRelationshipsCollection = 'targetRelationships'
const targetSpacecraftRelationshipTypesCollection = 'targetSpacecraftRelationshipTypes'
const targetMissionRelationshipTypesCollection = 'targetMissionRelationshipTypes'
const instrumentSpacecraftRelationshipTypes = 'instrumentSpacecraftRelationshipTypes'
const tagsCollection = 'tags'
const objectRelationshipsCollection = 'objectRelationships'
const toolsCollection = 'tools'
const successfulIndexesCollection = 'successfulIndexes'

const usersCollection = 'users'

let db
let client
let connectionPromise
let backupManager

let connect = async function() {
    if(!!connectionPromise) { 
        // if we're already building the db connection, just wait for that to finish
        await connectionPromise
        return
    }
    if(!db) {
        // if db hasn't been spun up, do so
        connectionPromise = new Promise(async (resolve, reject) => {
            try {
                client = await MongoClient.connect(url, { 
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                    poolSize: 10
                });
                console.log("connected successfully to database server");
    
                db = client.db(APP_NAME);
                resolve()
            } catch (err) {reject(err)}
        })
        await connectionPromise
        connectionPromise = null
    }
    // if we get here, db connection is established
}


function findPrimaryKey(type) {
    switch (type) {
        case datasetsCollection:
        case targetsCollection:
        case missionsCollection:
        case spacecraftCollection:
        case instrumentsCollection: return 'logical_identifier'
        case tagsCollection: return 'name'
        case instrumentSpacecraftRelationshipTypes:
        case targetMissionRelationshipTypesCollection:
        case targetSpacecraftRelationshipTypesCollection:return 'relationshipId'
        case toolsCollection: return 'toolId'
        default: return null
    }
}

module.exports = {
    datasets: datasetsCollection,
    targets: targetsCollection,
    missions: missionsCollection,
    spacecraft: spacecraftCollection,
    instruments: instrumentsCollection,
    targetRelationships: targetRelationshipsCollection,
    targetSpacecraftRelationshipTypes: targetSpacecraftRelationshipTypesCollection,
    targetMissionRelationshipTypes: targetMissionRelationshipTypesCollection,
    instrumentSpacecraftRelationshipTypes: instrumentSpacecraftRelationshipTypes,
    tags: tagsCollection,
    objectRelationships: objectRelationshipsCollection,
    tools: toolsCollection,
    successfulIndexes: successfulIndexesCollection,
    users: usersCollection,
    client: new Promise(async (resolve, reject) => {
            try{await connect()} catch(err) {reject(err)}
            resolve(client)
        }),
    setBackupManager: function(manager) {
        backupManager = manager
    },
    insert: async function(documents, type) {
        await connect()
        assert(documents.constructor === Array, "First argument must be an array of documents to insert")
        const collection = db.collection(type)
        const bulkOperation = collection.initializeUnorderedBulkOp()

        const primaryKey = findPrimaryKey(type)
        for(doc of documents) {
            doc._isActive = true;
            if(!!primaryKey) {
                bulkOperation.find({[primaryKey]: doc[primaryKey]}).upsert().replaceOne(doc)
            } else {
                bulkOperation.insert(doc)
            }
        }
        var result = await bulkOperation.execute();
        assert(result.result.ok)

        // flag the backup manager to upload the new data
        backupManager?.markAsDirty()

        return result.result.upserted
    },
    find: async function(inputFilter, type, fields, options) {
        await connect()
        const collection = db.collection(type)
        let activeFilter = { _isActive: true }
        Object.assign(activeFilter, inputFilter)
        const projection = fields ? fields.reduce((prev, current) => {
            prev[current] = 1
        }, { _id: 0}) : undefined
        const sort = options?.sort || { $natural: 1 }
        const limit = options?.limit || 0

        // bunch up all documents into array and return
        let cursor = collection.find(activeFilter, projection).sort(sort)
        if(limit > 0) {
            cursor = cursor.limit(limit)
        }
        const docs = await cursor.toArray()
        return docs.map(doc => hideInternalProperties(doc, options))
    },
    findAndStream: async function(inputFilter, type, stream, end, options) {
        await connect()
        const collection = db.collection(type)
        let activeFilter = { _isActive: true }
        Object.assign(activeFilter, inputFilter)

        // stream documents instead of grouping them together
        return new Promise((resolve, reject) => {
            collection.find(activeFilter).sort({$natural:1})
                .on('data', data => stream(hideInternalProperties(data, options)))
                .on('end', () => { end(); resolve()})
        })
    },
    deleteOne: async function(doc, type) {
        await connect()
        const collection = db.collection(type);

        const toUpdate = {
            _isActive: true,
            ...doc
        }
        // do a soft delete
        const result = await collection.updateOne(toUpdate, { $set: { _isActive: false }});

        // flag the backup manager to upload the new data
        backupManager?.markAsDirty()
        return result.ops;
    },
    insertRelationships: async function(documents) {
        assert(documents.constructor === Array, "First argument must be an array of documents to insert")
        await connect()
        const collection = db.collection(objectRelationshipsCollection)
        const bulkOperation = collection.initializeUnorderedBulkOp()

        for(doc of documents) {
            doc._isActive = true;
            bulkOperation.find({
                target: doc.target,
                instrument_host: doc.instrument_host,
                instrument: doc.instrument,
                investigation: doc.investigation,
                bundle: doc.bundle
            }).upsert().replaceOne(doc)
        }
        var result = await bulkOperation.execute();
        assert(result.result.ok)

        // flag the backup manager to upload the new data
        backupManager?.markAsDirty()
        return result.ops
    },
    join: async function(primaryType, foreignType, idField, foreignField, intoField) {
        await connect()
        const collection = db.collection(primaryType)

        const docs = await collection.aggregate([
        {
            $match: { _isActive: true }
        },
        {
            $lookup: {
                from: foreignType,
                as: intoField,
                let: { 
                    id: `$${idField}`
                },
                pipeline: [{
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ['$_isActive', true] },
                                { $eq: [`$$id`, `$${foreignField}`] }
                            ]
                        }
                    }
                }]
            }
        }]).toArray()
        return docs.map(hideInternalProperties)
    }
}

function hideInternalProperties(doc, options) {
    const visible = Object.keys(doc)
        .filter(key => !key.startsWith('_') || (options?.includeTimestamp && key === '_timestamp'))
        .reduce((obj, key) => {
            obj[key] = doc[key];
            return obj;
        }, {});
    if(!visible.updated_at && doc._timestamp) {
        visible.updated_at = new Date(doc._timestamp).toISOString()
    }
    return visible
}
