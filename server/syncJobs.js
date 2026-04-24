const { v4: uuidv4 } = require('uuid')

// Keep the N most recent sync jobs in memory. Older jobs are evicted on insert.
// The list is small by design - sync is admin-triggered, not on a hot path.
const MAX_RETAINED_JOBS = 25

const jobs = new Map()

function cloneJob(job) {
    return JSON.parse(JSON.stringify(job))
}

function evictIfNeeded() {
    if(jobs.size <= MAX_RETAINED_JOBS) {
        return
    }
    // Evict the oldest terminal (completed/failed) jobs first; never drop an
    // in-flight job even if that means exceeding the cap briefly.
    for(const [id, job] of jobs) {
        if(jobs.size <= MAX_RETAINED_JOBS) {
            return
        }
        if(job.status === 'completed' || job.status === 'failed') {
            jobs.delete(id)
        }
    }
}

function mutateSyncJob(id, mutator) {
    const job = jobs.get(id)
    if(!job) {
        return null
    }

    mutator(job)
    job.updatedAt = new Date().toISOString()
    jobs.set(id, job)
    return cloneJob(job)
}

function hasActiveSyncJob() {
    for(const job of jobs.values()) {
        if(job.status === 'queued' || job.status === 'running') {
            return true
        }
    }
    return false
}

module.exports = {
    createSyncJob({ suffix, refreshMode = 'incremental' }) {
        const now = new Date().toISOString()
        const id = uuidv4()
        const job = {
            id,
            suffix,
            status: 'queued',
            step: 'Queued publish',
            message: 'Waiting to start publishing.',
            error: null,
            createdAt: now,
            updatedAt: now,
            startedAt: null,
            finishedAt: null,
            publishProgress: {
                totalCollections: 0,
                completedCollections: 0,
                currentCollection: null
            },
            arcnav: {
                refreshMode,
                changedIdentifiers: 0,
                liveFlush: {
                    status: 'pending',
                    message: 'Waiting to notify Archive Navigator.'
                },
                revalidate: {
                    mode: refreshMode,
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
                    message: refreshMode === 'full'
                        ? 'Waiting to start a full Archive Navigator refresh.'
                        : 'Waiting to queue incremental refresh requests.',
                    failures: []
                }
            },
            result: null
        }
        jobs.set(id, job)
        evictIfNeeded()
        return cloneJob(job)
    },
    getSyncJob(id) {
        const job = jobs.get(id)
        return job ? cloneJob(job) : null
    },
    hasActiveSyncJob,
    mutateSyncJob
}
