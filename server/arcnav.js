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
const fullRefreshPollIntervalMs = 2000
const fullRefreshTimeoutMs = 20 * 60 * 1000
const incrementalConcurrency = 6
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

    let completed = 0
    let failed = 0
    const failures = []
    let cursor = 0

    const emitProgress = () => {
        const processed = completed + failed
        const inFlightIndex = Math.min(cursor, total - 1)
        const currentIdentifier = processed < total ? identifiers[inFlightIndex] : null
        onProgress?.(makeIncrementalStatus({
            status: processed < total ? 'running' : (failed > 0 ? 'failed' : 'completed'),
            total,
            completed,
            failed,
            currentIdentifier,
            message: processed < total
                ? `Refreshing ${Math.min(processed + 1, total)} of ${total} Archive Navigator records.`
                : (failed > 0
                    ? `Refreshed ${completed} Archive Navigator records with ${failed} failures.`
                    : `Refreshed ${completed} Archive Navigator records.`),
            failures: failures.slice()
        }))
    }

    emitProgress()

    const worker = async () => {
        while(true) {
            const index = cursor++
            if(index >= total) {
                return
            }
            const identifier = identifiers[index]
            try {
                await got.post(config.arcnavRevalidateUrl, {
                    headers: withSecretHeader(),
                    json: { identifier },
                    timeout: { request: requestTimeoutMs },
                    retry: defaultRetry
                })
                completed += 1
            } catch(err) {
                const message = toErrorMessage(err)
                console.error(`[arcnav] revalidate failed for ${identifier}: ${message}`)
                failed += 1
                failures.push({ identifier, error: message })
            }
            emitProgress()
        }
    }

    const workerCount = Math.max(1, Math.min(incrementalConcurrency, total))
    await Promise.all(Array.from({ length: workerCount }, () => worker()))

    return makeIncrementalStatus({
        status: failed > 0 ? 'failed' : 'completed',
        total,
        completed,
        failed,
        message: failed > 0
            ? `Refreshed ${completed} Archive Navigator records with ${failed} failures.`
            : `Refreshed ${completed} Archive Navigator records.`,
        failures: failures.slice()
    })
}

async function startFullRevalidateJob() {
    // Deliberately NO retry on this POST: the endpoint is not idempotent and
    // a transient 5xx or response-side timeout after the remote accepted the
    // job would cause us to start a second full reload. Network-level
    // failures here are reported to the caller, which will surface them in
    // the job status.
    const response = await got.post(config.arcnavRevalidateUrl, {
        headers: withSecretHeader(),
        json: { all: true, async: true },
        responseType: 'json',
        timeout: { request: requestTimeoutMs },
        retry: { limit: 0 }
    })

    return response.body
}

async function fetchFullRevalidateStatus(jobId) {
    const response = await got(config.arcnavRevalidateUrl, {
        searchParams: { jobId },
        headers: withSecretHeader(),
        responseType: 'json',
        timeout: { request: requestTimeoutMs },
        retry: defaultRetry
    })

    return response.body
}

function normalizeRemoteStatus(payload, jobId) {
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
    const total = extractNumber(payload?.total, payload?.progress?.total, payload?.counts?.total, payload?.stats?.total) ?? 1
    let completed = extractNumber(payload?.completed, payload?.progress?.completed, payload?.counts?.completed, payload?.stats?.completed)
    let failed = extractNumber(payload?.failed, payload?.progress?.failed, payload?.counts?.failed, payload?.stats?.failed) ?? 0
    const statusMessage = pickDefined(payload?.message, payload?.detail, payload?.result?.message)
    const errorMessage = pickDefined(payload?.error, payload?.errorMessage)

    if(completed === null) {
        completed = isCompleted ? total : 0
    }
    if(isFailed && failed === 0) {
        failed = 1
    }

    const normalizedStatus = isFailed ? 'failed' : (isCompleted ? 'completed' : 'running')
    const message = typeof (errorMessage || statusMessage) === 'string' && (errorMessage || statusMessage)
        ? (errorMessage || statusMessage)
        : (normalizedStatus === 'completed'
            ? `Archive Navigator full refresh job ${jobId} completed.`
            : `Archive Navigator full refresh job ${jobId} is still running.`)

    return {
        mode: 'full',
        status: normalizedStatus,
        total,
        completed,
        failed,
        currentIdentifier: null,
        remoteJobId: jobId,
        message,
        failures: normalizedStatus === 'failed'
            ? [{ identifier: `job:${jobId}`, error: message }]
            : []
    }
}

async function revalidateAllContent(onProgress) {
    if(!config.arcnavRevalidateUrl || !config.arcnavRevalidateSecret) {
        return {
            mode: 'full',
            status: 'skipped',
            total: 1,
            completed: 0,
            failed: 0,
            currentIdentifier: null,
            remoteJobId: null,
            message: 'Full Archive Navigator refresh is not configured.',
            failures: []
        }
    }

    onProgress?.({
        mode: 'full',
        status: 'running',
        total: 1,
        completed: 0,
        failed: 0,
        currentIdentifier: null,
        remoteJobId: null,
        message: 'Starting full Archive Navigator refresh. This can take several minutes.',
        failures: []
    })

    let jobId
    try {
        const payload = await startFullRevalidateJob()
        jobId = extractJobId(payload)
        if(!jobId) {
            throw new Error(`Archive Navigator full refresh did not return a job ID: ${JSON.stringify(payload)}`)
        }
    } catch(err) {
        const message = `Failed to start full Archive Navigator refresh: ${toErrorMessage(err)}`
        console.error('[arcnav]', message)
        return {
            mode: 'full',
            status: 'failed',
            total: 1,
            completed: 0,
            failed: 1,
            currentIdentifier: null,
            remoteJobId: null,
            message,
            failures: [{ identifier: 'all', error: message }]
        }
    }

    onProgress?.({
        mode: 'full',
        status: 'running',
        total: 1,
        completed: 0,
        failed: 0,
        currentIdentifier: null,
        remoteJobId: jobId,
        message: `Full Archive Navigator refresh job ${jobId} started. Waiting for completion.`,
        failures: []
    })

    const startedAt = Date.now()
    while(Date.now() - startedAt < fullRefreshTimeoutMs) {
        try {
            const payload = await fetchFullRevalidateStatus(jobId)
            const normalized = normalizeRemoteStatus(payload, jobId)
            onProgress?.(normalized)
            if(normalized.status === 'completed' || normalized.status === 'failed') {
                return normalized
            }
        } catch(err) {
            const message = `Failed to poll full Archive Navigator refresh job ${jobId}: ${toErrorMessage(err)}`
            console.error('[arcnav]', message)
            const failure = {
                mode: 'full',
                status: 'failed',
                total: 1,
                completed: 0,
                failed: 1,
                currentIdentifier: null,
                remoteJobId: jobId,
                message,
                failures: [{ identifier: `job:${jobId}`, error: message }]
            }
            onProgress?.(failure)
            return failure
        }

        await sleep(fullRefreshPollIntervalMs)
    }

    const timeout = {
        mode: 'full',
        status: 'failed',
        total: 1,
        completed: 0,
        failed: 1,
        currentIdentifier: null,
        remoteJobId: jobId,
        message: `Timed out waiting for full Archive Navigator refresh job ${jobId}.`,
        failures: [{ identifier: `job:${jobId}`, error: `Timed out waiting for job ${jobId}` }]
    }
    onProgress?.(timeout)
    return timeout
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
