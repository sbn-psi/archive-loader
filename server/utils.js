
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

module.exports = {
    streamHelper,
    streamList,
    standardChunk
}