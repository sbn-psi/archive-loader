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
        const collection = db.collection(datasetsCollection)
        if (documents.constructor === Array) {
            for(doc of documents) {
                doc._isActive = true;
            }
            var result = await collection.insertMany(documents)
            assert.equal(documents.length, result.result.n)
            assert.equal(documents.length, result.ops.length)
        } else {
            documents._isActive = true;
            var result = await collection.insertOne(documents)
            assert.equal(1, result.result.n)
            assert.equal(1, result.ops.length)
        }
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