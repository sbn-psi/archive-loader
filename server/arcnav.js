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
const requestTimeoutMs = 5 * 60 * 1000
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

function elapsedMs(startedAt) {
    return Date.now() - startedAt
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

function truncateString(value, maxLength = 1000) {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    if(!text || text.length <= maxLength) {
        return text
    }
    return `${text.slice(0, maxLength)}... [truncated ${text.length - maxLength} chars]`
}

function jsonByteLength(value) {
    try {
        return Buffer.byteLength(JSON.stringify(value), 'utf8')
    } catch {
        return null
    }
}

function summarizeIdentifiers(identifiers = []) {
    return {
        count: identifiers.length,
        first: identifiers.slice(0, 10),
        last: identifiers.length > 10 ? identifiers.slice(-10) : []
    }
}

function summarizeRevalidateBody(body) {
    if(body?.identifiers) {
        return {
            keys: Object.keys(body),
            identifiers: summarizeIdentifiers(body.identifiers),
            byteLength: jsonByteLength(body)
        }
    }

    return {
        keys: Object.keys(body || {}),
        body,
        byteLength: jsonByteLength(body)
    }
}

function summarizeRemotePayload(payload) {
    if(!payload || typeof payload !== 'object') {
        return payload
    }

    return {
        keys: Object.keys(payload),
        accepted: payload.accepted,
        all: payload.all,
        jobId: extractJobId(payload),
        status: payload.status,
        statusUrl: extractStatusUrl(payload),
        identifiers: Array.isArray(payload.identifiers) ? summarizeIdentifiers(payload.identifiers) : undefined,
        total: payload.total,
        paths: Array.isArray(payload.paths) ? { count: payload.paths.length, first: payload.paths.slice(0, 10) } : undefined,
        plannedPaths: Array.isArray(payload.plannedPaths) ? { count: payload.plannedPaths.length, first: payload.plannedPaths.slice(0, 10) } : undefined,
        attempted: payload.attempted,
        revalidatedPaths: Array.isArray(payload.revalidatedPaths) ? { count: payload.revalidatedPaths.length, first: payload.revalidatedPaths.slice(0, 10) } : undefined,
        failed: Array.isArray(payload.failed) ? { count: payload.failed.length, first: payload.failed.slice(0, 10) } : payload.failed,
        errors: Array.isArray(payload.errors) ? { count: payload.errors.length, first: payload.errors.slice(0, 10) } : payload.errors,
        error: payload.error
    }
}

function summarizeGotError(err) {
    return {
        name: err?.name,
        code: err?.code,
        event: err?.event,
        message: toErrorMessage(err),
        timings: err?.timings,
        responseStatusCode: err?.response?.statusCode,
        responseHeaders: err?.response?.headers,
        responseBody: err?.response?.body ? truncateString(err.response.body) : undefined
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
    const body = mode === 'full'
        ? { all: true }
        : {
            identifiers
        }
    const startedAt = Date.now()
    console.log('[arcnav] revalidate start request', {
        method: 'POST',
        url: config.arcnavRevalidateUrl,
        mode,
        timeoutMs: requestTimeoutMs,
        retryLimit: 0,
        headers: {
            'x-revalidate-secret': config.arcnavRevalidateSecret ? '[configured]' : '[missing]'
        },
        body: summarizeRevalidateBody(body)
    })

    try {
        const response = await got.post(config.arcnavRevalidateUrl, {
            headers: withSecretHeader(),
            json: body,
            responseType: 'json',
            timeout: { request: requestTimeoutMs },
            retry: { limit: 0 }
        })

        console.log('[arcnav] revalidate start response', {
            method: 'POST',
            url: config.arcnavRevalidateUrl,
            mode,
            elapsedMs: elapsedMs(startedAt),
            statusCode: response.statusCode,
            headers: response.headers,
            body: summarizeRemotePayload(response.body)
        })

        return response.body
    } catch(err) {
        console.error('[arcnav] revalidate start request failed', {
            method: 'POST',
            url: config.arcnavRevalidateUrl,
            mode,
            elapsedMs: elapsedMs(startedAt),
            error: summarizeGotError(err)
        })
        throw err
    }
}

async function fetchRevalidateStatus({ jobId, statusUrl }) {
    const resolvedStatusUrl = resolveStatusUrl(statusUrl)
    const url = resolvedStatusUrl || config.arcnavRevalidateUrl
    const searchParams = resolvedStatusUrl ? undefined : { jobId }
    const startedAt = Date.now()
    console.log('[arcnav] revalidate status request', {
        method: 'GET',
        url,
        searchParams,
        jobId,
        timeoutMs: requestTimeoutMs,
        retry: defaultRetry,
        headers: {
            'x-revalidate-secret': config.arcnavRevalidateSecret ? '[configured]' : '[missing]'
        }
    })

    try {
        const response = await got(url, {
            searchParams,
            headers: withSecretHeader(),
            responseType: 'json',
            timeout: { request: requestTimeoutMs },
            retry: defaultRetry
        })

        console.log('[arcnav] revalidate status response', {
            method: 'GET',
            url,
            searchParams,
            jobId,
            elapsedMs: elapsedMs(startedAt),
            statusCode: response.statusCode,
            headers: response.headers,
            body: summarizeRemotePayload(response.body)
        })

        return response.body
    } catch(err) {
        console.error('[arcnav] revalidate status request failed', {
            method: 'GET',
            url,
            searchParams,
            jobId,
            elapsedMs: elapsedMs(startedAt),
            error: summarizeGotError(err)
        })
        throw err
    }
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
    console.log('[arcnav] revalidate remote job preparing', {
        mode,
        revalidateUrl: config.arcnavRevalidateUrl,
        hasSecret: !!config.arcnavRevalidateSecret,
        identifiers: summarizeIdentifiers(identifiers),
        requestTimeoutMs,
        pollIntervalMs: revalidatePollIntervalMs,
        overallTimeoutMs: revalidateTimeoutMs
    })

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
        console.log('[arcnav] revalidate remote job accepted', {
            mode,
            jobId,
            statusUrl,
            resolvedStatusUrl: resolveStatusUrl(statusUrl),
            response: summarizeRemotePayload(payload)
        })
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
    let pollCount = 0
    while(Date.now() - startedAt < revalidateTimeoutMs) {
        try {
            pollCount += 1
            console.log('[arcnav] revalidate poll tick', {
                mode,
                jobId,
                pollCount,
                elapsedMs: elapsedMs(startedAt),
                statusUrl: resolveStatusUrl(statusUrl)
            })
            const payload = await fetchRevalidateStatus({ jobId, statusUrl })
            const normalized = normalizeRemoteStatus(payload, { jobId, statusUrl, mode, identifiers })
            console.log('[arcnav] revalidate poll normalized', {
                mode,
                jobId,
                pollCount,
                normalized: {
                    status: normalized.status,
                    total: normalized.total,
                    completed: normalized.completed,
                    failed: normalized.failed,
                    attempted: normalized.attempted,
                    plannedPaths: normalized.plannedPaths?.length,
                    paths: normalized.paths?.length,
                    revalidatedPaths: normalized.revalidatedPaths?.length,
                    failures: normalized.failures?.length,
                    message: normalized.message
                }
            })
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
        console.log('[arcnav] notify starting', {
            mode,
            since,
            until,
            changedIdentifiers: summarizeIdentifiers(changedIdentifiers),
            flushUrl: config.contextBrowserFlushUrl,
            revalidateUrl: config.arcnavRevalidateUrl,
            hasRevalidateSecret: !!config.arcnavRevalidateSecret
        })
        const liveFlush = await flushLiveArcnav()
        console.log('[arcnav] live cache flush result', liveFlush)
        onLiveFlushProgress?.(liveFlush)

        const revalidate = mode === 'full'
            ? await revalidateAllContent(onRevalidateProgress)
            : await revalidateChangedIdentifiers(changedIdentifiers, onRevalidateProgress)
        console.log('[arcnav] notify completed', {
            mode,
            changedIdentifierCount: changedIdentifiers.length,
            liveFlush,
            revalidate: {
                status: revalidate.status,
                total: revalidate.total,
                completed: revalidate.completed,
                failed: revalidate.failed,
                remoteJobId: revalidate.remoteJobId,
                statusUrl: revalidate.statusUrl,
                attempted: revalidate.attempted,
                plannedPaths: revalidate.plannedPaths?.length,
                paths: revalidate.paths?.length,
                revalidatedPaths: revalidate.revalidatedPaths?.length,
                failures: revalidate.failures?.length,
                message: revalidate.message
            }
        })

        return {
            changedIdentifiers,
            liveFlush,
            revalidate
        }
    }
}
