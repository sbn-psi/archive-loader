module.exports = class LogicalIdentifier {

    constructor(identifier, vid) {
        if(!identifier) { return }
        if(!!vid) {
            this.lidvid = `${identifier}::${vid}`
            this.lid = identifier
            this.vid = vid
        } else {
            this.lidvid = identifier
            let [lid, version] = identifier.split('::')
            this.lid = lid
            this.vid = version
        }
    }

    get escapedLid() {
        return escape(this.lid)
    }
    get escaped() {
        return escape(this.lidvid)
    }
    get escapedVid() {
        return escape(this.vid)
    }
}
function escape(str) {
    return str.replace(/:/g, '\\:')
}