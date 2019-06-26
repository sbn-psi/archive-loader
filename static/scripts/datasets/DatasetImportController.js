export default function($scope, $http, constants, existingDataset, sanitizer) {
    $scope.allDatasets = function() {
        let themAll = []
        if(!!$scope.model.bundle) { themAll.push($scope.model.bundle) }
        return themAll.concat($scope.model.collections);
    }

    const templateModel = function() {
        return {
            tags: [],
            publication: {},
            example: {},
            related_tools: [],
            related_data: [],
            superseded_data: [],
            download_packages: [],
        }
    }

    const prepDatasetFromEdit = function(dataset) {
        let obj = { bundle: null, collections: [] }

        // put tags back in objects, if necessary
        if(dataset.tags && dataset.tags.length > 0 && dataset.tags[0].constructor === String) {
            dataset.tags = dataset.tags.map(tag => { return { name: tag} })
        }

        // sort into bundle and collections
        if(dataset.logical_identifier && dataset.logical_identifier.split(':').length === 7) { // a lidvid with a collection will have 6 colons, thus 7 parts
            obj.collections.push(dataset)
        } else {
            obj.bundle = dataset
        }
        return obj;
    }

    const prepDatasetsFromHarvest = function(datasets) {
        const prep = dataset => {
            if(!dataset) { return null }
            const template = templateModel();
            Object.assign(dataset, template);
            dataset.logical_identifier = dataset.lidvid;
            dataset.display_name = dataset.name;
            dataset.display_description = dataset.abstract;
            dataset.browse_url = dataset.browseUrl;
            delete dataset.lidvid;
            delete dataset.name;
            delete dataset.abstract;
            delete dataset.browseUrl;
            return dataset
        }
        return {
            bundle: prep(datasets.bundle),
            collections: datasets.collections ? datasets.collections.map(prep) : []
        }
    }

    $scope.model = existingDataset ? prepDatasetFromEdit(existingDataset) : prepDatasetsFromHarvest($scope.state.datasets)

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
        $http.post('./datasets/add', postable).then(function(res) {
            $scope.state.progress();
            $scope.state.loading = false;
        }, function(err) {
            $scope.state.error = 'There was a problem';
            $scope.state.loading = false;
            console.log(err);
        })
    }
}