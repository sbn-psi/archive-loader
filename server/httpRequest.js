const request = require('got')
module.exports = async function httpRequest(baseUrl, params, body, username, password) {
    const options = {
        responseType: 'json'
    };
    if(!!params) { options.searchParams = params }
    if(!!body) { 
        options.json = body
        options.method = 'POST'
     }
    if(!!username) { options.username = username }
    if(!!password) { options.password = password }

    // console.log(`${baseUrl}${params ? '?' + Object.keys(params).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key])).join('&') : ''}`)

    return await request(baseUrl, options).json()
}
