const fs = require('fs')
const path = require('path')

const dotEnvPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(dotEnvPath)) {
    require('dotenv').config({ path: dotEnvPath })
}

function toBool(value, fallback = false) {
    if (value === undefined || value === null || value === '') {
        return fallback
    }
    return String(value).toLowerCase() === 'true'
}

function toInt(value, fallback = null) {
    if (value === undefined || value === null || value === '') {
        return fallback
    }
    const parsed = parseInt(value, 10)
    return Number.isNaN(parsed) ? fallback : parsed
}

function normalizePrefix(value) {
    if (!value) {
        return ''
    }
    return String(value).replace(/^\/+|\/+$/g, '')
}

function normalizeBasePath(value) {
    const normalized = normalizePrefix(value)
    return normalized ? `/${normalized}` : ''
}

const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    port: toInt(process.env.PORT, 8989),
    mongoUrl: process.env.MONGO_URL || (process.env.NODE_ENV === 'production' ? 'mongodb://mongo:27017' : 'mongodb://localhost:27017'),
    harvestUrl: process.env.HARVEST || 'http://localhost:3009',
    solrUrl: process.env.SOLR || 'http://localhost:8983/solr',
    solrUser: process.env.SOLR_USER || null,
    solrPass: process.env.SOLR_PASS || null,
    registryUrl: process.env.REGISTRY_URL || 'https://sbnpds4.psi.edu/solr/pds-alias/select',
    contextBrowserFlushUrl: process.env.CONTEXT_BROWSER_FLUSH_URL || 'https://arcnav.psi.edu/urn:nasa:pds:context:investigation:mission.orex',
    arcnavRevalidateUrl: process.env.ARCNAV_REVALIDATE_URL || null,
    arcnavRevalidateSecret: process.env.ARCNAV_REVALIDATE_SECRET || null,
    authSecret: process.env.AUTH_SECRET || '',
    adminUser: process.env.ADMIN_USER || 'admin',
    adminPass: process.env.ADMIN_PASS || '',
    appBasePath: normalizeBasePath(process.env.APP_BASE_PATH || ''),
    appEnvironment: process.env.APP_ENVIRONMENT || 'unknown',
    backupBucket: process.env.BACKUP_BUCKET || 'pds-sbn-psi-archiveloader-backup',
    awsRegion: process.env.AWS_REGION || null,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || null,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || null,
    imageUploads: {
        bucket: process.env.S3_IMAGE_BUCKET || null,
        prefix: normalizePrefix(process.env.S3_IMAGE_PREFIX || 'public'),
        baseUrl: process.env.S3_IMAGE_BASE_URL || null
    }
}

function missingRequiredEnv() {
    const required = [
        ['AUTH_SECRET', config.authSecret],
        ['ADMIN_PASS', config.adminPass],
        ['AWS_REGION', config.awsRegion],
        ['AWS_ACCESS_KEY_ID', config.awsAccessKeyId],
        ['AWS_SECRET_ACCESS_KEY', config.awsSecretAccessKey],
        ['S3_IMAGE_BUCKET', config.imageUploads.bucket]
    ]
    return required.filter(([, value]) => !value).map(([name]) => name)
}

module.exports = {
    config,
    missingRequiredEnv
}
