const assert = require('assert')
const got = require('got')
const { config } = require('../../config.js')

const id = 'registry-integrity'
const jobType = 'registry_verification'
const depthOptions = ['product', 'collection', 'bundle']
const modeOptions = ['head', 'checksum']
const fileTypeOptions = ['all', 'labels', 'data']

class ProviderRequestError extends Error {
    constructor(status, payload) {
        super(typeof payload === 'string' ? payload : `Request failed with ${status}`)
        this.status = status
        this.payload = payload
    }
}

function createClient() {
    return got.extend({
        prefixUrl: `${config.pdsfetchUrl.replace(/\/+$/, '')}/api/v1`,
        responseType: 'json',
        timeout: {
            request: 30000
        }
    })
}

const client = createClient()

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : ''
}

function normalizeLids(value) {
    const rawItems = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(/\r?\n|,/)
            : []

    return [...new Set(rawItems.map((item) => normalizeString(item)).filter(Boolean))]
}

function validateEnum(value, allowed, fieldName) {
    assert(allowed.includes(value), `Expected ${fieldName} to be one of: ${allowed.join(', ')}`)
}

function sanitizeCreateInput(body) {
    assert(body && typeof body === 'object', 'Expected request body')

    const lids = normalizeLids(body.lids)
    assert(lids.length > 0, 'Expected at least one LID or LIDVID')

    const depth = normalizeString(body.depth || 'product')
    const mode = normalizeString(body.mode || 'head')
    const file_types = normalizeString(body.file_types || 'all')
    const webhook_url = normalizeString(body.webhook_url)
    const webhook_secret = normalizeString(body.webhook_secret)

    validateEnum(depth, depthOptions, 'depth')
    validateEnum(mode, modeOptions, 'mode')
    validateEnum(file_types, fileTypeOptions, 'file_types')

    return {
        lids,
        depth,
        mode,
        file_types,
        webhook_url: webhook_url || undefined,
        webhook_secret: webhook_secret || undefined
    }
}

async function request(method, path, options = {}) {
    try {
        return await client(path, {
            method,
            ...options
        }).json()
    } catch (error) {
        const status = error.response?.statusCode || 502
        const payload = error.response?.body || error.message
        throw new ProviderRequestError(status, payload)
    }
}

function buildStoredRequest(payload) {
    return {
        lids: payload.lids,
        depth: payload.depth,
        mode: payload.mode,
        file_types: payload.file_types,
        webhook_url: payload.webhook_url || null,
        webhook_secret_configured: Boolean(payload.webhook_secret)
    }
}

module.exports = {
    id,
    jobType,
    depthOptions,
    modeOptions,
    fileTypeOptions,
    ProviderRequestError,
    sanitizeCreateInput,
    buildStoredRequest,
    async createJob(body) {
        const payload = sanitizeCreateInput(body)
        const response = await request('POST', `jobs/${jobType}`, {
            json: payload
        })
        assert(response && response.job_id, 'Remote service did not return a job_id')
        return {
            jobId: response.job_id,
            status: response.status || 'queued',
            storedRequest: buildStoredRequest(payload)
        }
    },
    getJob: async (jobId) => request('GET', `jobs/${encodeURIComponent(jobId)}`),
    getSummary: async (jobId) => request('GET', `jobs/${encodeURIComponent(jobId)}/summary`),
    getIssues: async (jobId, searchParams) => request('GET', `jobs/${encodeURIComponent(jobId)}/issues`, { searchParams }),
    getResults: async (jobId, searchParams) => request('GET', `jobs/${encodeURIComponent(jobId)}/results`, { searchParams })
}
