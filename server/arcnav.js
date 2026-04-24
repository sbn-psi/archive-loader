const got = require('got')
const db = require('./db.js')
const LID = require('./LogicalIdentifier')
const { config } = require('./config.js')

const trackedCollections = [
    db.datasets,
    db.targets,
    db.missions,
    db.spacecraft,
    db.instruments
]
const revalidatePollIntervalMs = 2000
const revalidateTimeoutMs = 20 * 60 * 1000
const remoteRevalidateConcurrency = 2
const remoteRevalidateBatchSize = 50
const requestTimeoutMs = 30 * 1000
const defaultRetry = {
    limit: 2,
    methods: ['GET', 'POST'],
    statusCodes: [408, 429, 500, 502, 503, 504]
}

function toErrorMessage(err) {
    if(err instanceof Error) {
        return err.message
    }
    return String(err)
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function pickDefined(...values) {
    return values.find((value) => value !== undefined && value !== null)
}

function extractNumber(...values) {
    for(const value of values) {
        if(typeof value === 'number' && Number.isFinite(value)) {
            return value
        }
    }
    return null
}

function extractArray(...values) {
    for(const value of values) {
        if(Array.isArray(value)) {
            return value
        }
    }
    return []
}

function extractJobId(payload) {
    if(!payload || typeof payload !== 'object') {
        return null
    }

    return pickDefined(
        payload.jobId,
        payload.jobID,
        payload.id,
        payload.data?.jobId,
        payload.result?.jobId
    ) ?? null
}

function extractStatusUrl(payload) {
    if(!payload || typeof payload !== 'object') {
        return null
    }

    return pickDefined(
        payload.statusUrl,
        payload.statusURL,
        payload.url,
        payload.data?.statusUrl,
        payload.result?.statusUrl
    ) ?? null
}

function resolveStatusUrl(statusUrl) {
    if(!statusUrl) {
        return null
    }
    try {
        return new URL(statusUrl, config.arcnavRevalidateUrl).toString()
    } catch {
        return statusUrl
    }
}

function withSecretHeader(extra) {
    return {
        'x-revalidate-secret': config.arcnavRevalidateSecret,
        ...(extra || {})
    }
}

async function collectChangedIdentifiers(since, until) {
    // Capture soft deletes too so Archive Navigator is told to drop their pages.
    // Soft deletes set _isActive: false and bump _timestamp (see server/db.js).
    // `until` enforces an upper bound that matches the DB snapshot uploaded to
    // Solr in this publish; anything written after that instant will be handled
    // by the next publish so we never revalidate a record that points at stale
    // Solr data.
    const timestampFilter = {}
    if(since) timestampFilter.$gt = since
    if(until) timestampFilter.$lte = until
    const filter = Object.keys(timestampFilter).length > 0 ? { _timestamp: timestampFilter } : {}
    const batches = await Promise.all(
        trackedCollections.map((collection) => db.find(
            filter,
            collection,
            ['logical_identifier'],
            { includeInactive: true }
        ))
    )

    const identifiers = new Set()
    batches.forEach((docs) => {
        docs.forEach((doc) => {
            if(doc.logical_identifier) {
                identifiers.add(new LID(doc.logical_identifier).lid)
            }
        })
    })

    return Array.from(identifiers).sort()
}

async function flushLiveArcnav() {
    if(!config.contextBrowserFlushUrl) {
        return {
            status: 'skipped',
            message: 'Archive Navigator cache flush is not configured.'
        }
    }

    try {
        await got(config.contextBrowserFlushUrl, {
            searchParams: { flush: true },
            timeout: { request: requestTimeoutMs },
            retry: defaultRetry
        })
        return {
            status: 'completed',
            message: 'Archive Navigator cache flush completed.'
        }
    } catch(err) {
        console.error('[arcnav] live cache flush failed:', err)
        return {
            status: 'failed',
            message: `Archive Navigator cache flush failed: ${toErrorMessage(err)}`
        }
    }
}

function makeIncrementalStatus(partial) {
    return {
        mode: 'incremental',
        status: 'pending',
        total: 0,
        completed: 0,
        failed: 0,
        currentIdentifier: null,
        remoteJobId: null,
        statusUrl: null,
        attempted: 0,
        plannedPaths: [],
        paths: [],
        revalidatedPaths: [],
        message: '',
        failures: [],
        ...partial
    }
}

async function revalidateChangedIdentifiers(identifiers, onProgress) {
    const total = identifiers.length

    if(!config.arcnavRevalidateUrl || !config.arcnavRevalidateSecret) {
        return makeIncrementalStatus({
            status: 'skipped',
            total,
            message: 'Incremental Archive Navigator refresh is not configured.'
        })
    }

    if(total === 0) {
        return makeIncrementalStatus({
            status: 'completed',
            message: 'No changed records required incremental refresh.'
        })
    }

    return revalidateRemoteJob({
        mode: 'incremental',
        identifiers,
        onProgress
    })
}

async function startRevalidateJob({ mode, identifiers = [] }) {
    // Deliberately NO retry on this POST: the endpoint is not idempotent and
    // a transient 5xx or response-side timeout after the remote accepted the
    // job would cause us to start a second refresh. Network-level
    // failures here are reported to the caller, which will surface them in
    // the job status.
    const isFull = mode === 'full'
    const response = await got.post(config.arcnavRevalidateUrl, {
        headers: withSecretHeader(),
        json: isFull
            ? { all: true }
            : {
                all: false,
                identifiers,
                concurrency: remoteRevalidateConcurrency,
                batchSize: remoteRevalidateBatchSize
            },
        responseType: 'json',
        timeout: { request: requestTimeoutMs },
        retry: { limit: 0 }
    })

    return response.body
}

async function fetchRevalidateStatus({ jobId, statusUrl }) {
    const resolvedStatusUrl = resolveStatusUrl(statusUrl)
    const response = await got(resolvedStatusUrl || config.arcnavRevalidateUrl, {
        searchParams: resolvedStatusUrl ? undefined : { jobId },
        headers: withSecretHeader(),
        responseType: 'json',
        timeout: { request: requestTimeoutMs },
        retry: defaultRetry
    })

    return response.body
}

function errorToFailure(error, index, fallbackIdentifier) {
    if(error && typeof error === 'object') {
        const identifier = pickDefined(error.identifier, error.lid, error.path, error.url, fallbackIdentifier, `error:${index + 1}`)
        const message = pickDefined(error.error, error.message, error.detail, JSON.stringify(error))
        return {
            identifier: String(identifier),
            error: String(message)
        }
    }

    return {
        identifier: fallbackIdentifier || `error:${index + 1}`,
        error: String(error)
    }
}

function normalizeRemoteStatus(payload, { jobId, statusUrl, mode, identifiers = [] }) {
    const rawStatus = pickDefined(
        payload?.status,
        payload?.state,
        payload?.jobStatus,
        payload?.data?.status,
        payload?.result?.status
    )
    const statusText = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : null
    const isFailed = statusText === 'failed' ||
        statusText === 'error' ||
        statusText === 'errored' ||
        statusText === 'cancelled' ||
        statusText === 'canceled' ||
        !!payload?.error
    const isCompleted = payload?.done === true ||
        statusText === 'completed' ||
        statusText === 'complete' ||
        statusText === 'done' ||
        statusText === 'success' ||
        statusText === 'succeeded'
    const plannedPaths = extractArray(payload?.plannedPaths, payload?.paths, payload?.data?.plannedPaths, payload?.result?.plannedPaths)
    const paths = extractArray(payload?.paths, payload?.data?.paths, payload?.result?.paths)
    const revalidatedPaths = extractArray(payload?.revalidatedPaths, payload?.data?.revalidatedPaths, payload?.result?.revalidatedPaths)
    const errors = extractArray(payload?.errors, payload?.failures, payload?.failed, payload?.data?.errors, payload?.result?.errors)
    const attempted = extractNumber(payload?.attempted, payload?.progress?.attempted, payload?.counts?.attempted, payload?.stats?.attempted)
    const total = extractNumber(payload?.total, payload?.progress?.total, payload?.counts?.total, payload?.stats?.total) ??
        (plannedPaths.length || paths.length || identifiers.length || (mode === 'full' ? 1 : 0))
    let completed = extractNumber(payload?.completed, payload?.progress?.completed, payload?.counts?.completed, payload?.stats?.completed)
    let failed = extractNumber(payload?.failed, payload?.progress?.failed, payload?.counts?.failed, payload?.stats?.failed) ?? errors.length
    const statusMessage = pickDefined(payload?.message, payload?.detail, payload?.result?.message)
    const errorMessage = pickDefined(payload?.error, payload?.errorMessage)

    if(completed === null) {
        completed = revalidatedPaths.length || attempted || (isCompleted ? Math.max(total - failed, 0) : 0)
    }
    if(isFailed && failed === 0) {
        failed = 1
    }

    const normalizedStatus = isFailed ? 'failed' : (isCompleted ? 'completed' : 'running')
    const refreshLabel = mode === 'full' ? 'full refresh' : 'incremental refresh'
    const message = typeof (errorMessage || statusMessage) === 'string' && (errorMessage || statusMessage)
        ? (errorMessage || statusMessage)
        : (normalizedStatus === 'completed'
            ? `Archive Navigator ${refreshLabel} job ${jobId} completed.`
            : `Archive Navigator ${refreshLabel} job ${jobId} is still running.`)
    const failures = errors.map((error, index) => errorToFailure(error, index, identifiers[index]))
    if(normalizedStatus === 'failed' && failures.length === 0) {
        failures.push({ identifier: `job:${jobId}`, error: message })
    }

    return {
        mode,
        status: normalizedStatus,
        total,
        completed,
        failed,
        currentIdentifier: null,
        remoteJobId: jobId,
        statusUrl: resolveStatusUrl(statusUrl),
        attempted: attempted ?? completed + failed,
        plannedPaths,
        paths,
        revalidatedPaths,
        message,
        failures
    }
}

function makeRevalidateStatus(partial) {
    return {
        mode: 'incremental',
        status: 'pending',
        total: 0,
        completed: 0,
        failed: 0,
        currentIdentifier: null,
        remoteJobId: null,
        statusUrl: null,
        attempted: 0,
        plannedPaths: [],
        paths: [],
        revalidatedPaths: [],
        message: '',
        failures: [],
        ...partial
    }
}

async function revalidateRemoteJob({ mode, identifiers = [], onProgress }) {
    if(!config.arcnavRevalidateUrl || !config.arcnavRevalidateSecret) {
        return makeRevalidateStatus({
            mode,
            status: 'skipped',
            total: mode === 'full' ? 1 : identifiers.length,
            message: `${mode === 'full' ? 'Full' : 'Incremental'} Archive Navigator refresh is not configured.`
        })
    }

    onProgress?.(makeRevalidateStatus({
        mode,
        status: 'running',
        total: mode === 'full' ? 1 : identifiers.length,
        message: mode === 'full'
            ? 'Queueing full Archive Navigator refresh. This can take several minutes.'
            : `Queueing incremental Archive Navigator refresh for ${identifiers.length} changed records.`
    }))

    let jobId
    let statusUrl
    try {
        const payload = await startRevalidateJob({ mode, identifiers })
        jobId = extractJobId(payload)
        statusUrl = extractStatusUrl(payload)
        if(!jobId) {
            throw new Error(`Archive Navigator ${mode} refresh did not return a job ID: ${JSON.stringify(payload)}`)
        }
        onProgress?.(normalizeRemoteStatus(payload, { jobId, statusUrl, mode, identifiers }))
    } catch(err) {
        const message = `Failed to start ${mode} Archive Navigator refresh: ${toErrorMessage(err)}`
        console.error('[arcnav]', message)
        return makeRevalidateStatus({
            mode,
            status: 'failed',
            total: mode === 'full' ? 1 : identifiers.length,
            message,
            failed: 1,
            failures: [{ identifier: mode === 'full' ? 'all' : 'identifiers', error: message }]
        })
    }

    const startedAt = Date.now()
    while(Date.now() - startedAt < revalidateTimeoutMs) {
        try {
            const payload = await fetchRevalidateStatus({ jobId, statusUrl })
            const normalized = normalizeRemoteStatus(payload, { jobId, statusUrl, mode, identifiers })
            onProgress?.(normalized)
            if(normalized.status === 'completed' || normalized.status === 'failed') {
                return normalized
            }
        } catch(err) {
            const message = `Failed to poll ${mode} Archive Navigator refresh job ${jobId}: ${toErrorMessage(err)}`
            console.error('[arcnav]', message)
            const failure = makeRevalidateStatus({
                mode,
                status: 'failed',
                total: mode === 'full' ? 1 : identifiers.length,
                failed: 1,
                remoteJobId: jobId,
                statusUrl: resolveStatusUrl(statusUrl),
                message,
                failures: [{ identifier: `job:${jobId}`, error: message }]
            })
            onProgress?.(failure)
            return failure
        }

        await sleep(revalidatePollIntervalMs)
    }

    const timeout = makeRevalidateStatus({
        mode,
        status: 'failed',
        total: mode === 'full' ? 1 : identifiers.length,
        failed: 1,
        remoteJobId: jobId,
        statusUrl: resolveStatusUrl(statusUrl),
        message: `Timed out waiting for ${mode} Archive Navigator refresh job ${jobId}.`,
        failures: [{ identifier: `job:${jobId}`, error: `Timed out waiting for job ${jobId}` }]
    })
    onProgress?.(timeout)
    return timeout
}

async function revalidateAllContent(onProgress) {
    return revalidateRemoteJob({
        mode: 'full',
        onProgress
    })
}

module.exports = {
    async notifyArcnav({ since, until, mode = 'incremental', onLiveFlushProgress, onRevalidateProgress }) {
        const changedIdentifiers = mode === 'incremental' ? await collectChangedIdentifiers(since, until) : []
        const liveFlush = await flushLiveArcnav()
        onLiveFlushProgress?.(liveFlush)

        const revalidate = mode === 'full'
            ? await revalidateAllContent(onRevalidateProgress)
            : await revalidateChangedIdentifiers(changedIdentifiers, onRevalidateProgress)

        return {
            changedIdentifiers,
            liveFlush,
            revalidate
        }
    }
}
