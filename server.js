// external modules
const {ObjectId} = require('mongodb')
const assert = require('assert')

// internal modules
require('./static/helpers.js')
const db = require('./db.js')
const solrize = require('./solrize.js')

// express setup
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
app.use(bodyParser.json())
app.use(express.static('static'))
app.listen(8989)
console.log('running on port 8989...')

app.post('/add', function(req, res) {
    let bailed = false
    // ensure input
    try {
        assert(req.body, "Failed to parse request")
        assert(req.body.bundle, "Expected bundle to be specified")
        assert(req.body.collections, "Expected collections to be specified")

    } catch (err) {
        res.status(400).send(err.message)
        bailed = true
        return
    }

    const validateDataset = function(dataset) {
        const require = function(fieldname) {
            if(fieldname.constructor === Array) {
                for(field of fieldname) {
                    require(field)
                }
            }
            assert(dataset[fieldname], `Expected ${fieldname} to be present`)
        }
        try {
            require(
                'logical_identifier',
                'display_name',
                'display_description',
                'publication',
                )
    
        } catch (err) {
            res.status(400).send(err.message)
            bailed = true
            return
        }

        dataset._timestamp = new Date().toLocaleString()
    }

    validateDataset(req.body.bundle)
    let toInsert = [req.body.bundle]

    for(collection of req.body.collections) {
        if(bailed) { return }

        validateDataset(collection)
        toInsert.push(collection)
    }

    // pull fields out of request for db insert

    if(bailed) { return }

    // insert and return
    db.connect(async function(dbConnection, complete) {
        const result = await db.insert(toInsert, dbConnection)
        complete()
        // let newRecord = result.ops[0]
        console.log(result)
        res.status(201).send( 'yay' )
    })

})

app.get('/export', function(req, res) {
    db.connect(async function(dbConnection, complete) {
        const result = await db.find(dbConnection, {})
        complete()
        res.status(200).send( solrize(result, "dataset") )
    })
})

app.get('/check/bundle', function(req, res) {
    res.status(200).send(TEMPORARYEXAMPLE);
})

app.get('/check/collection', function(req, res) {
    res.status(200).send({ collections: [TEMPORARYEXAMPLE.collections[0]] });
})

const TEMPORARYEXAMPLE = {
    bundle: {
        name: 'Example Bundle',
        lidvid: 'urn:nasa:pds:orex.ocams:1.0',
        abstract: `This bundle collects all the operational data products produced by the OSIRIS-REx Camera Suite (OCAMS).
        OCAMS is a suite of scientific cameras used for the characterization of the surface of (101955) Bennu.`,
        browseUrl: '',
    },
    collections: [
        {
            name: 'Origins, Spectral Interpretation, Resource Identification, Security, Regolith Explorer (OSIRIS-REx): Document',
            lidvid: 'urn:nasa:pds:orex.ocams:document:1.1',
            abstract: 'This collection contains the documents applicable to the OSIRIS-REx Camera Suite (OCAMS).',
            browseUrl: '',
        },
        {
            name: `Origins, Spectral Interpretation, Resource Identification, Security, Regolith Explorer (OSIRIS-REx): 
            OSIRIS-REx Camera Suite (OCAMS) calibration file collection.`,
            lidvid: 'urn:nasa:pds:orex.ocams:calibration:2.0',
            abstract: 'This collection contains the calibration files used to calibrate and correct the images acquired by the OCAMS instrument onboard the OSIRIS-REx spacecraft.',
            browseUrl: '',
        },
        {
            name: `Origins, Spectral Interpretation, Resource Identification, Security, Regolith Explorer (OSIRIS-REx): 
            OSIRIS-REx Camera Suite (OCAMS) raw science image data products.`,
            lidvid: 'urn:nasa:pds:orex.ocams:data_raw:2.0',
            abstract: 'This collection contains the raw (processing level 0) science image data products produced by the OCAMS instrument onboard the OSIRIS-REx spacecraft.',
            browseUrl: '',
        },
        {
            name: `Origins, Spectral Interpretation, Resource Identification, Security, Regolith Explorer (OSIRIS-REx): 
            OSIRIS-REx Camera Suite (OCAMS) reduced science image data products.`,
            lidvid: 'urn:nasa:pds:orex.ocams:data_reduced:2.0',
            abstract: `This collection contains the reduced (processing level 1 - bias, dark and flat field corrected) science image data products produced by the OCAMS instrument onboard the OSIRIS-REx spacecraft.`,
            browseUrl: '',
        },
        {
            name: `Origins, Spectral Interpretation, Resource Identification, Security, Regolith Explorer (OSIRIS-REx): 
            OSIRIS-REx Camera Suite (OCAMS) calibrated science image data products.`,
            lidvid: 'urn:nasa:pds:orex.ocams:data_calibrated:2.0',
            abstract: `This collection contains the calibrated (processing level 2 radiometrically calibrated and reflectance) science image data products produced by the OCAMS instrument onboard the OSIRIS-REx spacecraft.`,
            browseUrl: '',
        },
        {
            name: `Origins, Spectral Interpretation, Resource Identification, Security, Regolith Explorer (OSIRIS-REx): 
            OSIRIS-REx Camera Suite (OCAMS) raw housekeeping data products.`,
            lidvid: 'urn:nasa:pds:orex.ocams:data_hkl0:1.0',
            abstract: `This collection contains the raw housekeeping data products produced by the OCAMS instrument suite onboard the OSIRIS-REx spacecraft.`,
            browseUrl: '',
        },
        {
            name: `Origins, Spectral Interpretation, Resource Identification, Security, Regolith Explorer (OSIRIS-REx): 
            OSIRIS-REx Camera Suite (OCAMS) converted housekeeping data products.`,
            lidvid: 'urn:nasa:pds:orex.ocams:data_hkl1:1.0',
            abstract: `This collection contains the converted housekeeping data products produced by the OCAMS instrument suite onboard the OSIRIS-REx spacecraft.`,
            browseUrl: '',
        },
        {
            name: `Origins, Spectral Interpretation, Resource Identification, Security, Regolith Explorer (OSIRIS-REx): 
            OSIRIS-REx Camera Suite (OCAMS) ancillary image information data products.`,
            lidvid: 'urn:nasa:pds:orex.ocams:data_eng:1.0',
            abstract: `This collection contains the ancillary image information data products produced by the OCAMS instrument onboard the OSIRIS-REx spacecraft. This product contains all instrument housekeeping data collected at the time of image acquisition.`,
            browseUrl: '',
        }
    ]
}