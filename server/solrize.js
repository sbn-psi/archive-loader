const { v4: uuid4 } = require('uuid')

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

    for (const [key, value] of Object.entries(node)) {
        if (isDict(value)) {
            for (const [k, v] of Object.entries(value)) {
                doc[key + '.' + k] = v
            }
        }
        else if(isDictList(value)) {
            // create arrays for each key in the dictionaries
            const keys = Object.keys(value[0])
            for(const k of keys) {
                doc[key + '.' + k] = []
            }

            // push a value for each key in each dictionary, even if they are null
            for (dict of value) {
                for(k of keys) {
                    if(dict.hasOwnProperty(k)) {
                        doc[key + '.' + k].push(dict[k])
                    }
                    else {
                        doc[key + '.' + k].push(null)
                    }
                }
            }
        }
        else {
            doc[key] = value
        }
    }

    return doc
}

module.exports = solrizeDocument