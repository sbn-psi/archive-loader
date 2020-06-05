const request = require('got')
module.exports = async function httpRequest(baseUrl, params, body, username, password) {
    const options = {
        responseType: 'json'
    };
    if(!!params) { options.searchParams = params }
    if(!!body) { 
        options.body = body
        options.method = 'POST'
     }
    if(!!username) { options.username = username }
    if(!!password) { options.password = password }
    console.log(options)
    return await request(baseUrl, options).json()
}
