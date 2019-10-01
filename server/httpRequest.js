const request = require('request-promise-native')
module.exports = async function httpRequest(baseUrl, params) {
    const options = {
        uri: baseUrl,
        json: true,
        qs: params
    };
    return await request(options)
}
