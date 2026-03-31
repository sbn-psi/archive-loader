const express = require('express')
const db = require('../db.js')
const { getProvider } = require('../jobChecks')

const router = express.Router()

function toIsoTimestamp(value) {
    if (!value) {
        return null
    }
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function getStatus(remoteJob, fallback) {
    return remoteJob?.status || remoteJob?.job_status || fallback || 'unknown'
}

function getSyncErrorMessage(error) {
    if (!error) {
        return null
    }
    if (typeof error.payload === 'string') {
        return error.payload
    }
    if (error.payload && typeof error.payload === 'object' && typeof error.payload.detail === 'string') {
        return error.payload.detail
    }
    return error.message || 'Unable to sync job status'
}

function buildJobTitle(record) {
    const lids = Array.isArray(record.request?.lids) ? record.request.lids : []
    if (lids.length === 0) {
        return record.jobId
    }
    if (lids.length === 1) {
        return lids[0]
    }
    return `${lids[0]} + ${lids.length - 1} more`
}

function serializeRecord(record) {
    return {
        providerId: record.providerId,
        jobId: record.jobId,
        jobType: record.jobType,
        title: buildJobTitle(record),
        request: record.request,
        status: record.last_status || 'unknown',
        summary: record.last_summary || null,
        createdBy: record.created_by || null,
        createdAt: record.created_at || record.updated_at || null,
        updatedAt: record.updated_at || null,
        remoteCreatedAt: record.remote_created_at || null,
        remoteStartedAt: record.remote_started_at || null,
        remoteCompletedAt: record.remote_completed_at || null,
        webhookConfigured: Boolean(record.request?.webhook_url),
        webhookSecretConfigured: Boolean(record.request?.webhook_secret_configured),
        syncError: record.sync_error || null
    }
}

async function saveRecord(record) {
    const next = {
        ...record,
        _timestamp: new Date()
    }
    await db.insert([next], db.jobChecks)
    return next
}

function changed(left, right) {
    return JSON.stringify(left) !== JSON.stringify(right)
}

async function syncRecord(provider, record) {
    let remoteJob = null
    let remoteSummary = record.last_summary || null
    let syncError = null

    const [jobResult, summaryResult] = await Promise.allSettled([
        provider.getJob(record.jobId),
        provider.getSummary(record.jobId)
    ])

    if (jobResult.status === 'fulfilled') {
        remoteJob = jobResult.value
    } else {
        syncError = getSyncErrorMessage(jobResult.reason)
    }

    if (summaryResult.status === 'fulfilled') {
        remoteSummary = summaryResult.value
    } else if (!syncError) {
        syncError = getSyncErrorMessage(summaryResult.reason)
    }

    const nextRecord = {
        ...record,
        last_status: getStatus(remoteJob, record.last_status),
        last_summary: remoteSummary,
        remote_created_at: toIsoTimestamp(remoteJob?.created_at || record.remote_created_at),
        remote_started_at: toIsoTimestamp(remoteJob?.started_at || record.remote_started_at),
        remote_completed_at: toIsoTimestamp(remoteJob?.completed_at || record.remote_completed_at),
        sync_error: syncError
    }

    const hasChanges = changed(record.last_status, nextRecord.last_status)
        || changed(record.last_summary, nextRecord.last_summary)
        || changed(record.remote_created_at, nextRecord.remote_created_at)
        || changed(record.remote_started_at, nextRecord.remote_started_at)
        || changed(record.remote_completed_at, nextRecord.remote_completed_at)
        || changed(record.sync_error, nextRecord.sync_error)

    if (!hasChanges) {
        return {
            record,
            remoteJob,
            remoteSummary
        }
    }

    nextRecord.updated_at = new Date().toISOString()

    return {
        record: await saveRecord(nextRecord),
        remoteJob,
        remoteSummary
    }
}

async function findStoredRecord(providerId, jobId) {
    const matches = await db.find({ providerId, jobId }, db.jobChecks, null, { limit: 1 })
    return matches[0] || null
}

function getProviderOr404(req, res) {
    const provider = getProvider(req.params.providerId)
    if (!provider) {
        res.status(404).send(`Unknown job provider: ${req.params.providerId}`)
        return null
    }
    return provider
}

router.get('/:providerId', async function(req, res) {
    const provider = getProviderOr404(req, res)
    if (!provider) {
        return
    }

    const records = await db.find({ providerId: provider.id }, db.jobChecks, null, {
        sort: { _timestamp: -1, jobId: 1 }
    })

    const synced = await Promise.all(records.map((record) => syncRecord(provider, record)))
    res.status(200).send({
        provider: {
            id: provider.id,
            jobType: provider.jobType
        },
        count: synced.length,
        results: synced.map((entry) => serializeRecord(entry.record))
    })
})

router.post('/:providerId', async function(req, res) {
    const provider = getProviderOr404(req, res)
    if (!provider) {
        return
    }

    try {
        const created = await provider.createJob(req.body)
        const now = new Date().toISOString()
        const stored = await saveRecord({
            jobKey: `${provider.id}:${created.jobId}`,
            providerId: provider.id,
            jobId: created.jobId,
            jobType: provider.jobType,
            request: created.storedRequest,
            created_by: req.user || null,
            created_at: now,
            updated_at: now,
            last_status: created.status,
            last_summary: null,
            remote_created_at: null,
            remote_started_at: null,
            remote_completed_at: null,
            sync_error: null
        })

        res.status(201).send({
            record: serializeRecord(stored)
        })
    } catch (error) {
        const status = error.status || 400
        const payload = error.payload || error.message
        res.status(status).send(payload)
    }
})

router.get('/:providerId/:jobId', async function(req, res) {
    const provider = getProviderOr404(req, res)
    if (!provider) {
        return
    }

    const stored = await findStoredRecord(provider.id, req.params.jobId)
    if (!stored) {
        res.status(404).send('Unknown job ID')
        return
    }

    const synced = await syncRecord(provider, stored)
    let issues = null
    let results = null

    const query = {
        page: req.query.page || 1,
        page_size: req.query.page_size || 25
    }
    if (req.query.status) {
        query.status = req.query.status
    }
    if (req.query.result_type) {
        query.result_type = req.query.result_type
    }
    if (req.query.exclude_structural !== undefined) {
        query.exclude_structural = req.query.exclude_structural
    }
    if (req.query.issue_type) {
        query.issue_type = req.query.issue_type
    }

    const [issuesResult, resultsResult] = await Promise.allSettled([
        provider.getIssues(req.params.jobId, req.query.issue_type ? { issue_type: req.query.issue_type } : undefined),
        provider.getResults(req.params.jobId, query)
    ])

    if (issuesResult.status === 'fulfilled') {
        issues = issuesResult.value
    }
    if (resultsResult.status === 'fulfilled') {
        results = resultsResult.value
    }

    const detail = {
        record: serializeRecord(synced.record),
        remoteJob: synced.remoteJob,
        summary: synced.remoteSummary,
        issues,
        results
    }

    if (!issues && issuesResult.status === 'rejected' && !detail.record.syncError) {
        detail.record.syncError = getSyncErrorMessage(issuesResult.reason)
    }
    if (!results && resultsResult.status === 'rejected' && !detail.record.syncError) {
        detail.record.syncError = getSyncErrorMessage(resultsResult.reason)
    }

    res.status(200).send(detail)
})

module.exports = router
