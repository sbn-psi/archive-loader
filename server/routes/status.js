const express = require('express')
const router = express.Router()
const db = require('../db.js')

async function statusRequest(req, res, type, transformFn) {
    const result = await db.find({}, type)
    res.status(200).send({
        count: result.length,
        results: result.map(item => {
            let transform = { 
                name: item.display_name, 
                lid: item.logical_identifier,
                tags: item.tags,
                is_ready: item.is_ready,
                updated_at: item.updated_at || item._timestamp || null
            }
            if(transformFn) {
                transform = transformFn(item, transform)
            }
            return transform
        })
    })
}
router.get('/datasets', async function(req, res) {
    await statusRequest(req, res, db.datasets, (dataset, transform) => {
        return {
            ...transform,
            context: dataset.primary_context
        }
    })
})
router.get('/targets', async function(req, res) {
    await statusRequest(req, res, db.targets)
})
router.get('/missions', async function(req, res) {
    await statusRequest(req, res, db.missions)
})
router.get('/spacecraft', async function(req, res) {
    await statusRequest(req, res, db.spacecraft)
})
router.get('/instruments', async function(req, res) {
    const instruments = await db.join(db.instruments, db.objectRelationships, 'logical_identifier', 'instrument', 'relationships')
    res.status(200).send({
        count: instruments.length,
        results: instruments.map(instrument => { 
            const relationship = instrument.relationships.find(rel => !!rel.instrument_host)
            return { 
                name: instrument.display_name, 
                lid: instrument.logical_identifier,
                tags: instrument.tags,
                spacecraft: relationship ? relationship.instrument_host : null,
                updated_at: instrument.updated_at || instrument._timestamp || null
            }
        })
    })
})

router.get('/target-relationships', async function(req, res) {
    const relationships = await db.find({}, db.targetRelationships)
    const targets = await db.find({}, db.targets)
    res.status(200).send({
        targets: targets.map(item => { return { lid: item.logical_identifier, name: item.display_name } }),
        relationships
    })
})

router.get('/tools', async function(req, res) {
    const tools = await db.find({}, db.tools)
    res.status(200).send(tools)
})

router.get('/relationships', async function(req, res) {
    const tools = await db.find({}, db.objectRelationships)
    res.status(200).send(tools)
})

router.get('/datasets-missing-context', async function(req, res) {
    const datasets = await db.find({ $or: [{ primary_context: { $exists: false } }, { primary_context: null }, { primary_context: '' }] }, db.datasets, null, {
        sort: { _timestamp: -1, logical_identifier: 1 }
    })

    res.status(200).send({
        count: datasets.length,
        results: datasets.map((dataset) => ({
            name: dataset.display_name || dataset.logical_identifier,
            lid: dataset.logical_identifier,
            updated_at: dataset.updated_at || dataset._timestamp || null,
        }))
    })
})

router.get('/context-overview', async function(req, res) {
    const limit = 25
    const sort = { _timestamp: -1, logical_identifier: 1 }
    const [missions, spacecraft, instruments, targets] = await Promise.all([
        db.find({}, db.missions, null, { sort, limit }),
        db.find({}, db.spacecraft, null, { sort, limit }),
        db.find({}, db.instruments, null, { sort, limit }),
        db.find({}, db.targets, null, { sort, limit }),
    ])

    const missionIds = new Set()
    const addMissionId = (lid) => {
        if(lid) {
            missionIds.add(lid)
        }
    }

    missions.forEach((mission) => addMissionId(mission.logical_identifier))
    targets.forEach((target) => {
        if(target.logical_identifier) {
            missionIds.add(target.logical_identifier)
        }
    })

    const targetRelationships = targets.length > 0
        ? await db.find({ target: { $in: targets.map((item) => item.logical_identifier) } }, db.objectRelationships)
        : []
    const instrumentRelationships = instruments.length > 0
        ? await db.find({ instrument: { $in: instruments.map((item) => item.logical_identifier) } }, db.objectRelationships)
        : []

    const spacecraftByLid = Object.fromEntries(spacecraft.map((item) => [item.logical_identifier, item]))
    const missionByLid = Object.fromEntries(missions.map((item) => [item.logical_identifier, item]))
    const targetMissionMap = {}
    for (const relationship of targetRelationships) {
        if(relationship.target && relationship.investigation) {
            targetMissionMap[relationship.target] = relationship.investigation
            addMissionId(relationship.investigation)
        }
    }

    const instrumentSpacecraftMap = {}
    for (const relationship of instrumentRelationships) {
        if(relationship.instrument && relationship.instrument_host) {
            instrumentSpacecraftMap[relationship.instrument] = relationship.instrument_host
        }
    }

    const resolveMissionForRecord = (type, record) => {
        if(type === 'mission') {
            return record.logical_identifier
        }
        if(type === 'target') {
            return targetMissionMap[record.logical_identifier] || null
        }
        if(type === 'spacecraft') {
            return record.mission_override || null
        }
        if(type === 'instrument') {
            const spacecraftLid = instrumentSpacecraftMap[record.logical_identifier]
            if(!spacecraftLid) { return null }
            return spacecraftByLid[spacecraftLid]?.mission_override || null
        }
        return null
    }

    const groupMap = new Map()
    const ensureGroup = (missionLid) => {
        if(!groupMap.has(missionLid)) {
            const mission = missionByLid[missionLid]
            groupMap.set(missionLid, {
                mission: mission ? summarize('mission', mission) : { lid: missionLid, name: missionLid, type: 'mission', updated_at: null },
                missions: [],
                spacecraft: [],
                instruments: [],
                targets: [],
                latest_updated_at: null,
            })
        }
        return groupMap.get(missionLid)
    }

    const summarize = (type, item) => ({
        lid: item.logical_identifier,
        name: item.display_name || item.logical_identifier,
        type,
        updated_at: item.updated_at || item._timestamp || null,
    })

    const pushToGroup = (type, item) => {
        const missionLid = resolveMissionForRecord(type, item)
        if(!missionLid) {
            return
        }
        const group = ensureGroup(missionLid)
        const key = `${type}s`
        if(!group[key].find((entry) => entry.lid === item.logical_identifier)) {
            group[key].push(summarize(type, item))
        }
        const updated = item.updated_at || item._timestamp || null
        if(updated && (!group.latest_updated_at || updated > group.latest_updated_at)) {
            group.latest_updated_at = updated
        }
    }

    missions.forEach((item) => pushToGroup('mission', item))
    spacecraft.forEach((item) => pushToGroup('spacecraft', item))
    instruments.forEach((item) => pushToGroup('instrument', item))
    targets.forEach((item) => pushToGroup('target', item))

    const standalone = {
        spacecraft: spacecraft.filter((item) => !resolveMissionForRecord('spacecraft', item)).map((item) => summarize('spacecraft', item)),
        instruments: instruments.filter((item) => !resolveMissionForRecord('instrument', item)).map((item) => summarize('instrument', item)),
        targets: targets.filter((item) => !resolveMissionForRecord('target', item)).map((item) => summarize('target', item)),
    }

    const groups = [...groupMap.values()]
        .sort((left, right) => {
            const leftDate = left.latest_updated_at || left.mission.updated_at || ''
            const rightDate = right.latest_updated_at || right.mission.updated_at || ''
            return rightDate.localeCompare(leftDate)
        })
        .slice(0, 5)

    res.status(200).send({
        counts: {
            missions: await db.find({}, db.missions).then((items) => items.length),
            spacecraft: await db.find({}, db.spacecraft).then((items) => items.length),
            instruments: await db.find({}, db.instruments).then((items) => items.length),
            targets: await db.find({}, db.targets).then((items) => items.length),
        },
        groups,
        standalone,
    })
})

module.exports = router
