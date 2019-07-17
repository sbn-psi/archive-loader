const uuid4 = require('uuid/v4')

const isDict = function(item) {
    return (!!item) && (item.constructor === Object)
}
const isDictList = function(item) {
    return (!!item) && (item.constructor === Array) && isDict(item[0])
}

const solrizeDocument = function(doc, name) {
    let docs = []
    if (isDict(doc)) {
        docs.push(solrizeNode("", name, doc))
    }
    if (isDictList(doc)) {
        for (key in Object.keys(doc)) {
            if(doc.hasOwnProperty(key)) {
                docs.push(solrizeNode("", name, doc[key]))
            }
        }
    }
    return docs
}

const solrizeNode = function(parentPath, name, node) {
    let id = uuid4()
    let path = parentPath ? `${parentPath}.${name}` : name
    let doc = {
        attrname: name,
        attrpath: path,
        id: id
    }
    let childDocs = []

    for (const [key, value] of Object.entries(node)) {
        if (isDict(value)) {
            childDocs.push(solrizeNode(path, key, value))
        }
        else if(isDictList(value)) {
            for (element of value) {
                childDocs.push(solrizeNode(path, key, element))
            }
        }
        else {
            doc[key] = value
        }
    }

    if (childDocs.length > 0) {
        doc["_childDocuments_"] = childDocs
    }
    return doc
}

module.exports = solrizeDocument