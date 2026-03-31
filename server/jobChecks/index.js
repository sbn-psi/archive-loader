const registryIntegrityProvider = require('./providers/registryIntegrity.js')

const providers = {
    [registryIntegrityProvider.id]: registryIntegrityProvider
}

function getProvider(providerId) {
    return providers[providerId] || null
}

module.exports = {
    getProvider,
    listProviders: () => Object.values(providers)
}
