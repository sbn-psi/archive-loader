const url = process.env.NODE_ENV === 'production' ? 'mongodb://mongo:27017' : 'mongodb://localhost:27017'
const APP_NAME = 'app'
const assert = require('assert')

const {MongoClient} = require('mongodb')

const datasetsCollection = 'datasets'
const targetsCollection = 'targets'
const missionsCollection = 'missions'
const spacecraftCollection = 'spacecraft'
const instrumentsCollection = 'instruments'

let db;

module.exports = {
    datasets: datasetsCollection,
    targets: targetsCollection,
    missions: missionsCollection,
    spacecraft: spacecraftCollection,
    instruments: instrumentsCollection,
    connect: async function() {
        if(!db) {
            const client = await MongoClient.connect(url, { 
                useNewUrlParser: true,
                poolSize: 10
            });
            console.log("Connected successfully to database server");

            db = client.db(APP_NAME);
        }
    },
    insert: async function(documents, type) {
        assert(documents.constructor === Array, "First argument must be an array of documents to insert")
        const collection = db.collection(type)
        const bulkOperation = collection.initializeUnorderedBulkOp()

        for(doc of documents) {
            doc._isActive = true;
            bulkOperation.find({logical_identifier: doc.logical_identifier}).upsert().replaceOne(doc)
        }
        var result = await bulkOperation.execute();
        assert(result.result.ok)
        return result
    },
    find: async function(inputFilter, type) {
        const collection = db.collection(type)
        let activeFilter = { _isActive: true }
        Object.assign(activeFilter, inputFilter)
        const docs = await collection.find(activeFilter).toArray()

        // hide internal properties
        return docs.map(doc => {
            return Object.keys(doc)
                .filter(key => !key.startsWith('_'))
                .reduce((obj, key) => {
                    obj[key] = doc[key];
                    return obj;
                }, {});
        })
    },
    deleteOne: async function(id, type) {
        const collection = db.collection(type);
        // do a soft delete
        const result = await collection.updateOne({ '_id': id }, { $set: { _isActive: false }});
        return result;
    }
}