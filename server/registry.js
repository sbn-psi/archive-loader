const assert = require('assert')
const httpRequest = require('./httpRequest.js')
const LogicalIdentifier = require('./LogicalIdentifier')
const registryUrl = 'https://pds.nasa.gov/services/search/search'

const type = {
    spacecraft: 'spacecraft',
    mission: 'mission',
    instrument: 'instrument',
    target: 'target',
}

const referenceField = {
    [type.spacecraft]: 'instrument_host_ref',
    [type.mission]: 'investigation_ref',
    [type.instrument]: 'instrument_ref',
    [type.target]: 'target_ref'
}

const relatedTypeVal = {
    [type.spacecraft]: 'instrument_Host',
    [type.mission]: 'Investigation',
    [type.instrument]: 'Instrument',
    [type.target]: 'Target'
}

async function contextObjectLookupRequest(lid) {
    let solrResponse = await httpRequest(registryUrl, {
        wt: 'json',
        identifier: lid
    })
    assert(solrResponse.response.numFound != 0, "Could not find context object with that identifier")
    assert(solrResponse.response.numFound == 1, "Found more than one context object with that identifier")
    return solrResponse.response.docs[0]
}

async function lookupRelated(sourceType, desiredType, lid) {
    let findForeign = foreignReferences(sourceType, desiredType, lid)
    let findOwned = ownedReferneces(sourceType, desiredType, lid)
    let result = [...new Set([...await findForeign, ...await findOwned])] // concat arrays and remove duplicates
    return result.map(identifier => new LogicalIdentifier(identifier).lid)
}
async function foreignReferences(sourceType, desiredType, lid) {
    let solrResponse = await httpRequest(registryUrl, {
        wt: 'json',
        q: `${referenceField[sourceType]}:${new LogicalIdentifier(lid).escapedLid}\\:\\:* AND data_class:"${relatedTypeVal[desiredType]}"`,
        fl: 'identifier'
    })
    return solrResponse.response.docs.map(doc => doc.identifier)
}

async function ownedReferneces(sourceType, desiredType, lid) {
    let doc = await contextObjectLookupRequest(lid)
    return doc[referenceField[desiredType]]
}

module.exports = {
    type,
    contextObjectLookupRequest,
    lookupRelated
}
