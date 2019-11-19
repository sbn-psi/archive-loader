const request = require('request-promise-native')
module.exports = async function httpRequest(baseUrl, params, body, username, password) {
    const options = {
        uri: baseUrl,
        json: true
    };
    if(!!params) { options.qs = params }
    if(!!body) { options.body = body }
    if(!!username) { options.auth = {
        user: username,
        pass: password
    } }
    return await request(options)
}
