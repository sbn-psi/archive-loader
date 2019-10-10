const request = require('request-promise-native')
module.exports = async function httpRequest(baseUrl, params, body) {
    const options = {
        uri: baseUrl,
        json: true
    };
    if(!!params) { options.qs = params }
    if(!!body) { options.body = body }
    return await request(options)
}
