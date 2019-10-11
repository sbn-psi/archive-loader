const url = process.env.NODE_ENV === 'production' ? 'mongodb://mongo:27017' : 'mongodb://localhost:27017'
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
const instrumentSpacecraftRelationshipTypes = 'instrumentSpacecraftRelationshipTypes'
const tagsCollection = 'tags'
const objectRelationshipsCollection = 'objectRelationships'
const successfulIndexesCollection = 'successfulIndexes'

let db
let connectionPromise

module.exports = {
    datasets: datasetsCollection,
    targets: targetsCollection,
    missions: missionsCollection,
    spacecraft: spacecraftCollection,
    instruments: instrumentsCollection,
    targetRelationships: targetRelationshipsCollection,
    targetSpacecraftRelationshipTypes: targetSpacecraftRelationshipTypesCollection,
    instrumentSpacecraftRelationshipTypes: instrumentSpacecraftRelationshipTypes,
    tags: tagsCollection,
    objectRelationships: objectRelationshipsCollection,
    successfulIndexes: successfulIndexesCollection,
    connect: async function() {
        if(!!connectionPromise) { 
            // if we're already building the db connection, just wait for that to finish
            await connectionPromise
            return
        }
        if(!db) {
            // if db hasn't been spun up, do so
            connectionPromise = new Promise(async (resolve, reject) => {
                try {
                    const client = await MongoClient.connect(url, { 
                        useNewUrlParser: true,
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
    },
    insert: async function(documents, type) {
        assert(documents.constructor === Array, "First argument must be an array of documents to insert")
        const collection = db.collection(type)
        const bulkOperation = collection.initializeUnorderedBulkOp()

        for(doc of documents) {
            doc._isActive = true;
            if(!!doc.logical_identifier) {
                bulkOperation.find({logical_identifier: doc.logical_identifier}).upsert().replaceOne(doc)
            } else if (!!doc.relationshipId) {
                bulkOperation.find({relationshipId:doc.relationshipId}).upsert(true).replaceOne(doc)
            } else {
                bulkOperation.insert(doc)
            }
        }
        var result = await bulkOperation.execute();
        assert(result.result.ok)
        return result
    },
    find: async function(inputFilter, type, stream, end) {
        const collection = db.collection(type)
        let activeFilter = { _isActive: true }
        Object.assign(activeFilter, inputFilter)

        if(!!stream && !!end) {
            // stream documents instead of grouping them together
            return new Promise((resolve, reject) => {
                collection.find(activeFilter).sort({$natural:1})
                    .on('data', data => stream(hideInternalProperties(data)))
                    .on('end', () => { end(); resolve()})
            })
        } else {
            // bunch up all documents into array and return
            const docs = await collection.find(activeFilter).sort({$natural:1}).toArray()
            return docs.map(hideInternalProperties)
        }
    },
    deleteOne: async function(doc, type) {
        const collection = db.collection(type);
        const toUpdate = (doc.relationshipId) ? { 'relationshipId': doc.relationshipId } : { '_id': doc.id };
        // do a soft delete
        const result = await collection.updateOne(toUpdate, { $set: { _isActive: false }});
        return result;
    },
    insertRelationships: async function(documents) {
        assert(documents.constructor === Array, "First argument must be an array of documents to insert")
        const collection = db.collection(objectRelationshipsCollection)
        const bulkOperation = collection.initializeUnorderedBulkOp()

        for(doc of documents) {
            doc._isActive = true;
            bulkOperation.find({
                target: doc.target,
                instrument_host: doc.instrument_host,
                instrument: doc.instrument,
            }).upsert().replaceOne(doc)
        }
        var result = await bulkOperation.execute();
        assert(result.result.ok)
        return result
    }
}

function hideInternalProperties(doc) {
    return Object.keys(doc)
        .filter(key => !key.startsWith('_'))
        .reduce((obj, key) => {
            obj[key] = doc[key];
            return obj;
        }, {});
}