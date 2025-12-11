export default function($scope, $stateParams, $http, constants, existingDataset, sanitizer, prepForForm, tools, tags) {
    $scope.tools = tools
    $scope.tags = tags
    $scope.allDatasets = function() {
        let themAll = []
        if(!!$scope.model.bundle) { themAll.push($scope.model.bundle) }
        return themAll.concat($scope.model.collections);
    }

    const templateModel = function() {
        return {
            tags: [],
            tools: [],
            publication: {},
            example: {},
            related_data: [],
            superseded_data: [],
            download_packages: [],
        }
    }

    const isBundle = (lidvid) => {
                if(!lidvid) { return false }
                // first: strip off any version component
                const lid = lidvid.split('::')[0];

                // bundles are urn:nasa:pds:bundle so have 4 parts
                return lid.split(':').length === 4;
            }

    const prepDatasetFromEdit = function(dataset) {
        let obj = { bundle: null, collections: [] }

        dataset = prepForForm(dataset, templateModel)

        // sort into bundle and collections
        if(dataset.logical_identifier && isBundle(dataset.logical_identifier)) {
            obj.collections.push(dataset)
        } else {
            obj.bundle = dataset
        }
        return obj;
    }

    const prepDatasetsFromHarvest = function(datasets) {
        const mapping = {
            logical_identifier:     'lidvid',
            display_name:           'name',
            display_description:    'abstract',
            browse_url:             'browseUrl',
            target_lid:             'target_lid',
            target_name:            'target_name',
            mission_lid:            'mission_lid',
            instrument_lid:         'instrument_lid',
        }
        const prep = fromHarvest => {
            if(!fromHarvest) { return null }
            const dataset = templateModel();
            Object.keys(mapping).forEach(key => {
                const harvestKey = mapping[key]
                dataset[key] = fromHarvest[harvestKey]
            })
            return dataset
        }
        return {
            bundle: prep(datasets ? datasets.bundle : templateModel()),
            collections: (datasets && datasets.collections) ? datasets.collections.map(prep) : []
        }
    }

    $scope.model = existingDataset 
                    ? prepDatasetFromEdit(existingDataset)
                    : $scope.state.datasets 
                        ? prepDatasetsFromHarvest($scope.state.datasets)
                        : $stateParams.type === constants.bundleType ? { bundle: templateModel(), collections: [] } : { collections: [templateModel()]}

    $scope.view = {
        active: $scope.model.bundle ? $scope.model.bundle : $scope.model.collections[0],
        type: $scope.model.bundle ? constants.bundleType : constants.collectionType
    }

    $scope.autocomplete = function(model, current, parentObj) {
        let vals = [current];
        let fieldPool;
        if(!!parentObj) {
            //if this is a child object set (like 'related datasets'), create an array of all objects that contain the field in question
            fieldPool = $scope.allDatasets().reduce((pool, ds) => { 
                let item = ds[parentObj]; if(!item) { return pool };
                return item.constructor === Array ? pool.concat(item) : [...pool, item]
            }, [])
            
            // for related data, also add in the names/lids of other datasets being worked on
            if(parentObj === 'related_data') {
                let otherDatasets = $scope.allDatasets().filter(ds => ds.logical_identifier !== $scope.view.active.logical_identifier)
                if(model === 'name') { 
                    vals = vals.concat(otherDatasets.map(ds => ds.name));
                } else if (model === 'lid'){
                    vals = vals.concat(otherDatasets.map(ds => ds.lidvid.split('::')[0]));
                }
            }
        } else {
            // otherwise, just draw from all datasets, since the field will be directly on them
            fieldPool = $scope.allDatasets();
        }

        // create a list of all values accross all datasets, filtering out empty or duplicated entries
        return vals.concat(fieldPool.map(ds => ds[model]).filter(field => !!field).reduce((pool, item) => pool.includes(item) ? pool : [...pool, item], []))
    }

    $scope.submit = function() {
        $scope.state.error = null;
        $scope.state.loading = true;            
        let postable = {
            bundle: sanitizer($scope.model.bundle, templateModel),
            collections: $scope.model.collections.map(c => sanitizer(c, templateModel))
        }
        $http.post('./save/datasets', postable).then(function(res) {
            $scope.state.progress();
            $scope.state.loading = false;
        }, function(err) {
            $scope.state.error = err.data || 'There was a problem';
            $scope.state.loading = false;
            console.log(err);
        })
    }
}