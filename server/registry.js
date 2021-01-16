const assert = require('assert')
const httpRequest = require('./httpRequest.js')
const LID = require('./LogicalIdentifier')
const registryUrl = 'https://pds.nasa.gov/services/search/search'

const type = {
    spacecraft: 'spacecraft',
    mission: 'mission',
    instrument: 'instrument',
    target: 'target',
    bundle: 'bundle'
}

const referenceField = {
    [type.spacecraft]: 'instrument_host_ref',
    [type.mission]: 'investigation_ref',
    [type.instrument]: 'instrument_ref',
    [type.target]: 'target_ref',
    [type.bundle]: 'bundle_ref' // not actually a thing
}

const relatedTypeVal = {
    [type.spacecraft]: 'instrument_Host',
    [type.mission]: 'Investigation',
    [type.instrument]: 'Instrument',
    [type.target]: 'Target',
    [type.bundle]: 'Product_Bundle'
}

async function contextObjectLookupRequest(lid, fields) {
    let solrResponse = await httpRequest(registryUrl, {
        wt: 'json',
        identifier: lid,
        rows: 1,
        fl: (fields && fields.constructor === Array) ? fields.join(',') : fields
    })
    assert(solrResponse.response.numFound != 0, "Could not find context object with that identifier")
    assert(solrResponse.response.numFound == 1, "Found more than one context object with that identifier")
    return solrResponse.response.docs[0]
}

async function lookupRelated(sourceType, desiredType, lid) {
    let findForeign = foreignReferences(sourceType, desiredType, lid)
    let findOwned = ownedReferneces(sourceType, desiredType, lid)
    
    // concat arrays and remove duplicates
    let result = [...await findForeign, ...await findOwned] 
    let uniqueLids = [...new Set(result.map(identifier => new LID(identifier).lid))]

    // get names for each, and return
    return await fieldLookup(uniqueLids, 'identifier,title')
}


async function foreignReferences(sourceType, desiredType, lid) {
    let solrResponse = await httpRequest(registryUrl, {
        wt: 'json',
        q: `${referenceField[sourceType]}:${new LID(lid).escapedLid}\\:\\:* AND (data_class:"${relatedTypeVal[desiredType]}" OR product_class:"${relatedTypeVal[desiredType]}")`,
        fl: 'identifier',
        rows: 100
    })
    return solrResponse.response.docs.map(doc => doc.identifier)
}
async function ownedReferneces(sourceType, desiredType, lid) {
    let doc = await contextObjectLookupRequest(lid)
    let owned = doc[referenceField[desiredType]]
    return owned ? owned : []
}
async function fieldLookup(identifiers, fields) {
    if(identifiers.length === 0) { return []}
    let solrResponse = await httpRequest(registryUrl, {
        wt: 'json',
        q: identifiers.reduce((query, lid) => query + 'identifier:"' + new LID(lid).lid + '" ', ''),
        fl: fields,
        rows: 100
    })
    return solrResponse.response.docs
}

module.exports = {
    type,
    contextObjectLookupRequest,
    lookupRelated
}
