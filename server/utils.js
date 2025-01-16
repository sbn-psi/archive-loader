const { XMLParser } = require('fast-xml-parser');

function streamHelper(res, chunkHandler) {
    res.set('Content-Type', 'json')
    let listStreamer = streamList(res, chunkHandler)
    return {
        data: listStreamer.data,
        end: () => {
            listStreamer.end()
            res.end()
        }
    }

}
function streamList(res, chunkHandler) {
    res.write('[')
    let prevChunk
    return {
        data: data => {
            if(prevChunk) { 
                res.write(chunkHandler(prevChunk) + ',')
            }
            prevChunk = data
        },
        end: () => {
            if(prevChunk) {
                res.write(chunkHandler(prevChunk))
            }
            res.write(']')
        }
    }
}

function standardChunk(chunk) {
    return JSON.stringify(chunk, null, "\t")
}

// Create a new XML parser instance
const xmlParser = new XMLParser({
    ignoreAttributes: false, // harvest puts field names in attributes
    attributeNamePrefix: "@", // Prefix for attributes when they make it to json
    parseTagValue: true // Tag values have the field values
});

module.exports = {
    streamHelper,
    streamList,
    standardChunk,
    xmlParser
}