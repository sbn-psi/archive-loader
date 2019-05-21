const url = process.env.NODE_ENV === 'production' ? 'mongodb://mongo:27017' : 'mongodb://localhost:27017'
const name = 'app'
const assert = require('assert')

const {MongoClient} = require('mongodb')

const datasetsCollection = 'datasets'
module.exports = {
    connect: async function(callback) {
        // Use connect method to connect to the server
        const client = await MongoClient.connect(url, { useNewUrlParser: true });
        console.log("Connected successfully to database server");
    
        const db = client.db(name);
    
        await callback(db, function() {
            client.close();
            console.log("Closed database connection");
        })
    },
    insert: async function(documents, db) {
        assert(documents.constructor === Array, "First argument must be an array of documents to insert")
        const collection = db.collection(datasetsCollection)
        const bulkOperation = collection.initializeUnorderedBulkOp()

        for(doc of documents) {
            doc._isActive = true;
            bulkOperation.find({logical_identifier: doc.logical_identifier}).upsert().replaceOne(doc)
        }
        var result = await bulkOperation.execute();
        assert(result.result.ok)
        return result
    },
    find: async function(db, inputFilter) {
        const collection = db.collection(datasetsCollection)
        let activeFilter = { _isActive: true }
        Object.assign(activeFilter, inputFilter)
        const docs = await collection.find(activeFilter).toArray()
        return docs
    },
    deleteOne: async function(db, id) {
        const collection = db.collection(datasetsCollection);
        // do a soft delete
        const result = await collection.updateOne({ '_id': id }, { $set: { _isActive: false }});
        return result;
    }
}