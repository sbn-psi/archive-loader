const isEmptyObject = obj =>  {
    if (obj.constructor === Object) {
        for(var key in obj) {
            if(obj.hasOwnProperty(key) && !key.startsWith('$$') && !!obj[key]) {
                return false;
            }
        }
        return true;
    }
    return false;
}



app.constant('sanitizer', function(formObject, templateModel) {
    if(!formObject) { return null }

    let sanitized = templateModel()
    for (const [key, value] of Object.entries(formObject)) {
        // put each field into the new sanitized object, unless it's inherited or angular-specific
        if (formObject.hasOwnProperty(key) && !key.startsWith('$$') && !!value) {
            if(value.constructor === Array) {
                // trim empty objects from the arrays
                let trimmed = value.filter(item => !isEmptyObject(item)) 
                sanitized[key] = trimmed;
            } else {
                // turn empty objects into nulls
                sanitized[key] = isEmptyObject(value) ? null : value;
            }
        }
    }

    // clean up tags, specifically
    if(!!sanitized.tags) { sanitized.tags = sanitized.tags.map(tag => tag.name)}

    return sanitized;
})

app.constant('prepForForm', function(model, templateFn) {
    if(!model) { return null }

    let template = templateFn()
    let prepped = Object.assign({}, model)

    Object.keys(template).forEach(key =>  {
        if(prepped[key] === undefined) {
            prepped[key] = template[key]
        }
    })

    // prep tags, specifically
    if(!!prepped.tags) { 
        prepped.tags = prepped.tags.map(tag => { 
            if(tag.constructor === Object && !!tag.name) { return tag }
            return {name: tag}
        })
    }

    return prepped;
})

app.service('lidCheck', function($http) {
    return function(lid, fields) {
        return new Promise(function(resolve, reject) {
            if(!!lid && lid.constructor === String && lid.split(':').length > 3 && lid.startsWith('urn:nasa')) {
                $http.get('./lookup', {params: {lid, fields}}).then(function(res) {
                    resolve(res.data)
                }, function(err) {
                    reject(err)
                })
            } else {
                reject('Invalid lid')
            }
        })
    }
})

app.service('relatedLookup', function($http) {
    return function(from, to, lid) {
        return new Promise(function(resolve, reject) {
            if(!!lid && lid.constructor === String && lid.split(':').length > 3 && lid.startsWith('urn:nasa')) {
                $http.get(`./related/${to}?${from}=${lid}`).then(function(res) {
                    resolve(res.data)
                }, function(err) {
                    reject(err)
                })
            } else {
                reject('Invalid lid')
            }
        })
    }
})

app.constant('isPopulated', (val) => val && val.length > 0)

app.controller('FormController', function($scope, constants) {
    $scope.progress = {}
    $scope.groupRepeater = function(array) {
        if(array.length === 0 || !isEmptyObject(array.last())) {
            array.push({})
        }
        return array.filter((val, index) => { return index === array.length-1 || !isEmptyObject(val)})
    }
    $scope.spacecraftIds = constants.spacecraftIds
    $scope.instrumentIds = constants.instrumentIds
})

app.controller('ContextObjectImportController', function($scope, $http, sanitizer, prepForForm, lidCheck, isPopulated, existing, tags, targetRelationships, instrumentRelationships, tools) {
    $scope.tags = tags
    $scope.targetRelationships = targetRelationships
    $scope.instrumentRelationships = instrumentRelationships
    $scope.tools = tools
    $scope.config = {}
    $scope.editing = existing ? true : false

    const validate = function() {
        const object = $scope.model[$scope.config.modelName]
        
        const lidValid = isPopulated(object.logical_identifier) && object.logical_identifier.startsWith($scope.config.lidPrefix)
        const requiredFieldsPresent = $scope.config.requiredFields.every(field => isPopulated($scope.model[$scope.config.modelName][field]))
        const relationshipsHaveValues = $scope.config.relationshipModelNames.every(modelName => $scope.model[modelName].every(rel => !!rel.relationshipId))
        return lidValid ? requiredFieldsPresent ? relationshipsHaveValues ? true : 'All relationships must have types set' : 'Some required fields are missing' : 'LID does not start with ' + $scope.config.lidPrefix
    }

    const templateModel = function() {
        return {
            tags: [],
        }
    }

    $scope.submit = function() {
        let validation = validate()
        if(validation === true) {
            $scope.state.error = null;
            $scope.state.loading = true; 
            
            const object = $scope.model[$scope.config.modelName]
            verifyNew(object.logical_identifier).then(() => {
                let postablePrimary = sanitizer(object, templateModel)
                let primaryPost = $http.post($scope.config.primaryPostEndpoint, postablePrimary)
                let backendRequests = [primaryPost]
    
                let postableRelationships = []
                $scope.config.relationshipModelNames.forEach(relName => {
                    postableRelationships = postableRelationships.concat($scope.model[relName].map(rel => $scope.config.relationshipTransformer(rel, relName)))
                })
                if(postableRelationships.length > 0) {
                    backendRequests.push($http.post('./save/relationships', postableRelationships))
                }
    
                Promise.all(backendRequests).then(function(res) {
                    $scope.state.progress();
                    $scope.state.loading = false;
                }, function(err) {
                    $scope.state.error = err.data;
                    $scope.state.loading = false;
                    console.log(err);
                })
            }, error => {
                $scope.state.loading = false;
                $scope.state.error = error
                $scope.$apply()
            })
            
        } else {
            $scope.state.error = validation;
        }
    }

    let configurated = false
    $scope.$watch('config.modelName', function(modelName) {
        if(!modelName || configurated === true) return
        configurated = true

        $scope.model = {
            [modelName]: existing ? prepForForm(existing.object, templateModel) : templateModel()
        }
        $scope.config.relationshipModelNames.forEach(relName => {
            if(!$scope.model[relName]) { $scope.model[relName] = []}
            let relationships = existing ? existing.relationships.reduce((arr, rel) => $scope.config.relationshipUnpacker(arr, rel, relName), []) : []
            $scope.model[relName] = $scope.model[relName].concat(relationships)
        })
        
        if(!$scope.editing) {
            $scope.$watch(`model.${modelName}.logical_identifier`, function(lid) {
                if(!lid) { return }
                $scope.state.loading = true;
                
                verifyNew(lid).then(() => {
                    checkLid(lid)
                }, error => {
                    $scope.state.loading = false;
                    $scope.state.error = error
                    $scope.$apply()
                })
                
            })
        }
    })

    function verifyNew(lid) {
        if($scope.editing) {
            return Promise.resolve()
        }

        return new Promise((resolve, reject) => {
            $http.get('./edit/' + $scope.config.modelName, { params: { logical_identifier: lid }}).then(
                (response) => {
                    if(!!response.data && !!response.data.object) {
                        reject(`${lid} already exists. It should be edited instead of added.`)
                    } else {
                        resolve()
                    }
                }, resolve)
        })
    }

    function checkLid(lid) {
        let registryFields = $scope.config.lookupReplacements.map(replacement => replacement.registryField)
        lidCheck(lid, registryFields).then(function(doc) {
            $scope.state.loading = false;
            const replace = (scopeKey, docKey) => {
                if(!isPopulated($scope.model[$scope.config.modelName][scopeKey])) { $scope.model[$scope.config.modelName][scopeKey] = doc[docKey][0] }
            }
            $scope.config.lookupReplacements.forEach(replacement => replace(replacement.formField, replacement.registryField))
            $scope.$apply()
        }, function(err) { 
            $scope.state.loading = false;
            $scope.$apply()
            // don't care about errors
        })
    }
})

app.filter('pluralizeDumb', function() {
    return function(input) {
      return (angular.isString(input) && !input.toUpperCase().endsWith('SPACECRAFT')) ? `${input}s` : input;
    }
});

app.constant('constants', {
    bundleType: 'Bundle',
    collectionType: 'Collection',
    spacecraftIds: ["24COL",
    "A12A",
    "A12C",
    "A12L",
    "A14A",
    "A14C",
    "A14L",
    "A15A",
    "A15C",
    "A15L",
    "A15S",
    "A16A",
    "A16C",
    "A16L",
    "A16S",
    "A17A",
    "A17C",
    "A17L",
    "A17S",
    "AAO",
    "AMON",
    "APO35M",
    "ARCB",
    "ASTR",
    "AUSTC14",
    "BUGLAB",
    "C130",
    "C154",
    "CFHT",
    "CH1-ORB",
    "CLEM1",
    "CO",
    "CON",
    "CTIO",
    "CTIO15",
    "CTIO15M",
    "CTIOPPT",
    "DAWN",
    "DIF",
    "DII",
    "DS1",
    "ECAS",
    "ER-2",
    "ESO",
    "ESO1M",
    "ESO22M",
    "FEXP",
    "GDSCC",
    "GEMGB",
    "GIO",
    "GO",
    "GP",
    "GRAIL-A",
    "GRAIL-B",
    "GSR",
    "GSSR",
    "HAY",
    "HP",
    "HST",
    "HSTK",
    "ICE",
    "IRAS",
    "IRSN",
    "IRTF",
    "IUE",
    "KECK1",
    "KP36",
    "KP50",
    "KP84",
    "LAB510",
    "LAB7154",
    "LAB9884",
    "LCROSS",
    "LICK1M",
    "LO72",
    "LOWELL",
    "LP",
    "LRO",
    "LSPN",
    "M10",
    "MCD21",
    "MCD27",
    "MCD27M",
    "MDM",
    "MER1",
    "MER2",
    "MESS",
    "MEX",
    "MGN",
    "MGS",
    "MK88",
    "MKO",
    "MKOPPT",
    "MKOUH22M",
    "MMTO",
    "MO",
    "MODEL",
    "MPFL",
    "MPFR",
    "MR6",
    "MR7",
    "MR9",
    "MRO",
    "MRO24M",
    "MSL",
    "MSN",
    "MSSSO",
    "MSX",
    "MTBG61",
    "MTSC14",
    "N/A",
    "NDC8",
    "NEAR",
    "NH",
    "NNSN",
    "NRAO",
    "O325T1",
    "O325T2",
    "O376T1",
    "O376T3",
    "O413T2",
    "OAO",
    "OBS007T1",
    "OBS055T3",
    "OBS055T4",
    "OBS055T6",
    "OBS056T2",
    "OBS056T3",
    "OBS056T6",
    "OBS056T9",
    "OBS060T2",
    "OBS157T4",
    "OBS211T1",
    "OBS211T2",
    "OBS240T1",
    "OBS270T7",
    "OBS288T5",
    "OBS295T3",
    "OBS320T13",
    "OBS321T1",
    "OBS321T3",
    "OBS321T4",
    "OBS325T1",
    "OBS325T2",
    "OBS326T2",
    "OBS327T1",
    "OBS333T1",
    "OBS333T2",
    "OBS3340T1",
    "OBS338T6",
    "OBS347T2",
    "OBS347T3",
    "OBS376T1",
    "OBS376T2",
    "OBS376T3",
    "OBS378T2",
    "OBS413T2",
    "OBS445T3",
    "OBS4701T1",
    "OBS4702T1",
    "OBS4703T1",
    "OBS6490T1",
    "OBS6491T1",
    "OBS6618T1",
    "ODY",
    "P10",
    "P11",
    "P12",
    "PAL",
    "PAL200",
    "PEDB",
    "PGD",
    "PHB2",
    "PHX",
    "PPN",
    "PUBLIT",
    "PVO",
    "REUNIC14",
    "RL",
    "RO",
    "RSN",
    "S229",
    "SAKIG",
    "SDU",
    "SIM",
    "SOHO",
    "SPEC",
    "SUISEI",
    "TRRLAB",
    "UH",
    "ULY",
    "UNK",
    "V15",
    "V16",
    "VARGBTEL",
    "VEGA1",
    "VEGA2",
    "VEX",
    "VG1",
    "VG2",
    "VL1",
    "VL2",
    "VO1",
    "VO2",
    "VTH",
    "WFF",
    "WHT",
    "WIYN"],
    instrumentIds: ["120CVF",
    "2CP",
    "8CPS",
    "A-STAR",
    "ACCEL",
    "ACP",
    "AGILE",
    "ALICE",
    "AMES-GCM",
    "AMICA",
    "AMPG",
    "AMSP",
    "AMVIS",
    "API",
    "APPH",
    "APS",
    "APXS",
    "ASAR",
    "ASAS",
    "ASE",
    "ASI",
    "ASIMET",
    "ASPERA-3",
    "ASTR",
    "ATM",
    "AVIR",
    "AWND",
    "B&C",
    "B-STAR",
    "BUG",
    "CAM1",
    "CAM2",
    "CAPS",
    "CASPIR",
    "CCD",
    "CCD47",
    "CCDC",
    "CCDIMGR",
    "CCIG",
    "CDA",
    "CFCCD",
    "CFI",
    "CHEMCAM_LIBS",
    "CHEMCAM_RMI",
    "CHEMCAM_SOH",
    "CHEMIN",
    "CIDA",
    "CIRC",
    "CIRS",
    "CLIO",
    "COM",
    "COMPIL",
    "COSIMA",
    "COSPIN-AT",
    "COSPIN-HET",
    "COSPIN-HFT",
    "COSPIN-KET",
    "COSPIN-LET",
    "CPI",
    "CRAT",
    "CRISM",
    "CRISP",
    "CRISPIMAG",
    "CRISPSPEC",
    "CRS",
    "CRT",
    "CS2",
    "CTIOCCD",
    "CTX",
    "CVF",
    "DAED",
    "DAN",
    "DBP",
    "DDS",
    "DERIV",
    "DESCAM",
    "DFMI",
    "DID",
    "DISR",
    "DK2A",
    "DLRE",
    "DSS13",
    "DSS14",
    "DSS15",
    "DSS25",
    "DTWG",
    "DUCMA",
    "DWE",
    "DYNSCI",
    "EMMI",
    "ENG",
    "EPA",
    "EPAC",
    "EPAS",
    "EPD",
    "EPI",
    "EPPS",
    "ER",
    "ES2",
    "ESOCCD",
    "ESP",
    "EUV",
    "FC1B",
    "FC2",
    "FC2A",
    "FC3A",
    "FGM",
    "FHAZ_LEFT_A",
    "FHAZ_LEFT_B",
    "FHAZ_RIGHT_A",
    "FHAZ_RIGHT_B",
    "FPA",
    "FRONT_HAZCAM_LEFT",
    "FTS",
    "GAS",
    "GBT",
    "GCMS",
    "GDDS",
    "GIADA",
    "GPMS",
    "GPSM",
    "GRAND",
    "GRB",
    "GRE",
    "GRS",
    "GTT",
    "GWE",
    "HAD",
    "HASI",
    "HAZCAM",
    "HFE",
    "HIC",
    "HIRES",
    "HIRISE",
    "HISCALE",
    "HMC",
    "HRD",
    "HRII",
    "HRIV",
    "HRSC",
    "HSCCD",
    "HSOTP",
    "HSTACS",
    "HSTP",
    "HUYGENS_HK",
    "HVM",
    "I0028",
    "I0034",
    "I0035",
    "I0037",
    "I0038",
    "I0039",
    "I0046",
    "I0051",
    "I0052",
    "I0054",
    "I0055",
    "I0059",
    "I0060",
    "I0061",
    "I0062",
    "I0065",
    "I0066",
    "I0069",
    "I0070",
    "I0071",
    "I0276",
    "I0287",
    "I0373",
    "I0387",
    "I0390",
    "I0391",
    "I0576",
    "I0655",
    "I0679",
    "I0680",
    "I0681",
    "I0682",
    "I0688",
    "I0942",
    "I0943",
    "I0962",
    "I0964",
    "I0965",
    "I0966",
    "I1063",
    "I1083",
    "I1084",
    "I1092",
    "I1093",
    "I1094",
    "I1349",
    "I1376",
    "I1485",
    "I1496",
    "I1833",
    "I1834",
    "I2041",
    "ICI",
    "IDS",
    "IGI",
    "IIRAR",
    "IKS",
    "IMF",
    "IMP",
    "IMS",
    "IMU",
    "INMS",
    "INSBPHOT",
    "IPP",
    "IRFCURV",
    "IRFTAB",
    "IRIMAG",
    "IRIS",
    "IRPHOT",
    "IRPOL",
    "IRR",
    "IRS",
    "IRSPEC",
    "IRTM",
    "ISIS",
    "ISS",
    "ISSN",
    "ISSNA",
    "ISSW",
    "ISSWA",
    "ITS",
    "JPA",
    "KECK1LWS",
    "KRFM",
    "LAMP",
    "LASCO",
    "LCS",
    "LECP",
    "LEISA",
    "LEND",
    "LFTS",
    "LGRS-A",
    "LGRS-B",
    "LIDAR",
    "LO72CCD",
    "LOLA",
    "LORRI",
    "LPLCCD",
    "LR1",
    "LR2",
    "LRD",
    "LROC",
    "LSPN",
    "LSRP",
    "LWIR",
    "LWP",
    "LWR",
    "M3",
    "M3SPEC",
    "MAG",
    "MAGER",
    "MAHLI",
    "MAR",
    "MARCI",
    "MARDI",
    "MARSIS",
    "MASCS",
    "MAST_LEFT",
    "MAST_RIGHT",
    "MAWD",
    "MB",
    "MCDIDS",
    "MCS",
    "MDIS-NAC",
    "MDIS-WAC",
    "MECA_AFM",
    "MECA_ELEC",
    "MECA_TECP",
    "MECA_WCL",
    "MET",
    "MI",
    "MICAS",
    "MIDAS",
    "MIMI",
    "MINI-TES",
    "MIR1",
    "MIR2",
    "MIRO",
    "MISCHA",
    "MLA",
    "MOC",
    "MOLA",
    "MRFFR",
    "MRFLRO",
    "MRI",
    "MRS",
    "MSI",
    "MSNRDR",
    "MSNVIS",
    "MTES",
    "MVIC",
    "N/A",
    "NAVCAM",
    "NAV_LEFT_A",
    "NAV_LEFT_B",
    "NAV_RIGHT_A",
    "NAV_RIGHT_B",
    "NEP",
    "NFR",
    "NGIMS",
    "NIMS",
    "NIR",
    "NIR1",
    "NIR2",
    "NIRS",
    "NIS",
    "NLR",
    "NMS",
    "NNSN",
    "NS",
    "NSFCAM",
    "NSP1",
    "NSP2",
    "OASIS",
    "OEFD",
    "OETP",
    "OIMS",
    "OM",
    "OMAG",
    "OMEGA",
    "ONMS",
    "OPE",
    "ORAD",
    "ORPA",
    "ORSE",
    "OSINAC",
    "OSIWAC",
    "OUVS",
    "PA",
    "PANCAM",
    "PARB",
    "PEPE",
    "PEPSSI",
    "PFES",
    "PFS",
    "PHOT",
    "PHOTDOC",
    "PHOTGJON",
    "PIA",
    "PLAWAV",
    "PLS",
    "PM1",
    "POS",
    "PPFLX",
    "PPMAG",
    "PPOL",
    "PPR",
    "PPS",
    "PPSTOKE",
    "PRA",
    "PUMA",
    "PWS",
    "QUIRC",
    "RA",
    "RAC",
    "RAD",
    "RADAR",
    "RADR",
    "RADWAV",
    "RAT",
    "RCAC31034A",
    "RCLT",
    "RCRR",
    "RCRT",
    "RDRS",
    "REAG",
    "REBELXT",
    "REMS",
    "RHAZ_LEFT_A",
    "RHAZ_LEFT_B",
    "RHAZ_RIGHT_A",
    "RHAZ_RIGHT_B",
    "RMTR",
    "ROE",
    "ROSINA",
    "RPCICA",
    "RPCIES",
    "RPCLAP",
    "RPCMAG",
    "RPWS",
    "RSCN",
    "RSI",
    "RSOC",
    "RSOH",
    "RSRDR",
    "RSS",
    "RSS-VG1S",
    "RSS-VG2S",
    "RSS-VG2U",
    "RSSL",
    "RSUV",
    "RTLS",
    "RVRC",
    "SAM",
    "SCE",
    "SDC",
    "SEIS",
    "SHARAD",
    "SHYG",
    "SIRS",
    "SOW",
    "SP1",
    "SP2",
    "SPEC",
    "SPICAM",
    "SPICE",
    "SPIRIT3",
    "SPK",
    "SQIID",
    "SRC",
    "SSD",
    "SSI",
    "SSP",
    "SUSI",
    "SWAP",
    "SWICS",
    "SWOOPS",
    "SWP",
    "SWS",
    "TEGA",
    "TEL",
    "TES",
    "TG",
    "THEMIS",
    "THRM",
    "TIMS",
    "TLM",
    "TLP",
    "TNM",
    "TRD",
    "TS",
    "TT",
    "TVS",
    "UDDS",
    "UHCCD",
    "ULECA",
    "UNK",
    "URAC",
    "URAP",
    "UV",
    "UVIS",
    "UVS",
    "UVVIS",
    "VARGBDET",
    "VHM/FGM",
    "VIMS",
    "VIR",
    "VIRTIS",
    "VIS",
    "VISA",
    "VISB",
    "VSK",
    "VSP",
    "WFPC2",
    "WI",
    "WINDSOCK",
    "WTHS",
    "XGR",
    "XRFS",
    "XRS"]
});