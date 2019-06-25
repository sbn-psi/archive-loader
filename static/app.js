var app = angular.module('app', ['ui.bootstrap', 'ui.router']);

app.constant('constants', {
    bundleType: 'Bundle',
    collectionType: 'Collection'
});

app.config(function($stateProvider) {
    $stateProvider.state({
        name: 'datasets',
        url: '/Datasets',
        redirectTo: 'datasets.load'
    })
    $stateProvider.state({
        name: 'datasets.import',
        url: '/Import?edit',
        templateUrl: 'states/datasets/import.html',
        params: { edit: null },
        data: {
            title: 'Load Datasets'
        },
        resolve: {
            existingDataset: function($http, $stateParams) {
                if(!!$stateParams.edit) {
                    return $http.get('./datasets/edit', { params: { logical_identifier: $stateParams.edit }}).then(function(res) { return res.data[0] })
                } else {
                    return null
                }
            }
        },
        controller: 'DatasetImportController'
    })
    $stateProvider.state({
        name: 'datasets.load',
        url: '/Load',
        templateUrl: 'states/datasets/load.html',
        data: {
            title: 'Load Datasets'
        }
    })
    $stateProvider.state({
        name: 'datasets.manage',
        url: '/Manage',
        templateUrl: 'states/datasets/manage.html',
        data: {
            title: 'Manage Datasets'
        }
    })

    $stateProvider.state({
        name: 'targets',
        url: '/Targets',
        redirectTo: 'targets.manage'
    })
    $stateProvider.state({
        name: 'targets.import',
        url: '/Import?edit',
        templateUrl: 'states/targets/import.html',
        params: { edit: null },
        data: {
            title: 'Add Target'
        },
        resolve: {
            existingTarget: function($http, $stateParams) {
                if(!!$stateParams.edit) {
                    return $http.get('./targets/edit', { params: { logical_identifier: $stateParams.edit }}).then(function(res) { return res.data[0] })
                } else {
                    return null
                }
            }
        },
        controller: 'TargetImportController'
    })
    $stateProvider.state({
        name: 'targets.manage',
        url: '/Manage',
        templateUrl: 'states/targets/manage.html',
        data: {
            title: 'Manage Targets'
        }
    })
});

app.directive('titleContainer', function() {
    return {
        template: '{{title}}',
        controller: function($scope, $transitions) {
            $transitions.onStart({}, function(trans) {
                let entering = trans.entering();
                if(!!entering[entering.length-1].data) {
                    $scope.title = entering[entering.length-1].data.title;
                } else {
                    $scope.title = 'Archive Loader';
                }
            })
        }
    }   
})

app.controller('RootController', function($scope, constants, $state) {
    $scope.state = {
        datasetType: constants.bundleType,
        progress: function() {
            switch($state.current.name) {
                case 'datasets.load': $state.go('datasets.import'); break;
                case 'datasets.import': $state.go('datasets.manage'); break;
                case 'datasets.manage': $state.go('datasets.import'); break;
                case 'targets.import': $state.go('targets.manage'); break;
                case 'targets.manage': $state.go('targets.import'); break;
            }
        },
        loading: false,
        error: null,
        alerts: []
    };

    $scope.constants = constants;
    $state.go('datasets.load');
});

app.controller('DatasetLoaderController', function ($scope, $http, constants) {
    const collectionCheckUrl = './datasets/check/collection';
    const bundleCheckUrl = './datasets/check/bundle';

    $scope.fetch = function () {
        $scope.state.error = null;
        if($scope.state.datasetUrl) {
            const options = { params: {
                url: $scope.state.datasetUrl
            }}

            let endpoint = $scope.state.datasetType == constants.bundleType ? bundleCheckUrl : collectionCheckUrl;
            $http.get(endpoint, options).then(function (res) {
                $scope.state.datasets = res.data;
                $scope.state.progress();
                $scope.state.loading = false;
            }, function(err) {
                $scope.state.loading = false;
                $scope.state.error = err.data;
            })
            $scope.state.loading = true;
        }
    };
});

app.controller('DatasetImportController', function($scope, $http, constants, existingDataset, sanitizer) {
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

        // put tags back in objects
        dataset.tags = dataset.tags.map(tag => { return { name: tag} })

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
            bundle: sanitize($scope.model.bundle),
            collections: $scope.model.collections.map(c => sanitize(c))
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

    const sanitize = function(dataset) {
        let sanitized = sanitizer(dataset, templateModel)
        
        // put tag names into a direct array
        if(sanitized.tags) {
            sanitized.tags = sanitized.tags.map(tag => tag.name)
        }

        return sanitized
    }
});

app.controller('DatasetManageController', function($scope, $http, $state) {
    $http.get('./datasets/status').then(function(res) {
        $scope.status = res.data;
    }, function(err) {
        $scope.state.error = err;
    })

    $scope.edit = function(lidvid) {
        $state.go('datasets.import', {edit: lidvid})
    }
});


app.controller('TargetImportController', function($scope, $http, existingTarget, sanitizer) {
    
    const templateModel = function() {
        console.log(existingTarget)
        return {
            tags: [],
            related_targets: [],
            missions: [],
        }
    }
    $scope.model = {
        target: existingTarget ? existingTarget : templateModel()
    }

    $scope.submit = function() {
        if(validate()) {
            $scope.state.error = null;
            $scope.state.loading = true;            
            let postable = sanitize($scope.model.target)

            $http.post('./targets/add', postable).then(function(res) {
                $scope.state.progress();
                $scope.state.loading = false;
            }, function(err) {
                $scope.state.error = 'There was a problem';
                $scope.state.loading = false;
                console.log(err);
            })
        } else {
            $scope.state.error = 'Target was invalid';
        }
    }

    const validate = function() {
        const isPopulated = (val) => val && val.length > 0
        return  isPopulated($scope.model.target.logical_identifier) &&
                isPopulated($scope.model.target.display_name) &&
                isPopulated($scope.model.target.display_description) &&
                isPopulated($scope.model.target.image_url) &&
                isPopulated($scope.model.target.category)
    }

    const sanitize = function(targetForm) {
        let sanitized = sanitizer(targetForm, templateModel)
        
        // put tag names into a direct array
        if(sanitized.tags) {
            sanitized.tags = sanitized.tags.map(tag => tag.name)
        }

        return sanitized
    }
});

app.controller('TargetsManageController', function($scope, $http, $state) {
    $http.get('./targets/status').then(function(res) {
        $scope.status = res.data;
    }, function(err) {
        $scope.state.error = err;
    })

    $scope.edit = function(lidvid) {
        $state.go('targets.import', {edit: lidvid})
    }
});

app.constant('sanitizer', function(formObject, templateModel) {
    const isEmptyObject = obj =>  {
        if (obj && obj.constructor === Object) {
            for(var key in obj) {
                if(obj.hasOwnProperty(key) && !key.startsWith('$$'))
                    return false;
            }
            return true;
        }
        return false;
    }
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
    return sanitized;
})


app.controller('FormController', function($scope) {
    $scope.groupRepeater = function(array) {
        if(array.length === 0 || !isEmptyObject(array.last())) {
            array.push({})
        }
        return array;
    }

    const isEmptyObject = obj =>  {
        if (obj.constructor === Object) {
            for(var key in obj) {
                if(obj.hasOwnProperty(key) && !key.startsWith('$$'))
                    return false;
            }
            return true;
        }
        return false;
    }
})

app.directive('datasetImportForm', function () {
    return {
        templateUrl: 'directives/dataset-import-form.html',
        scope: {
            dataset: '=',
            type: '<',
            autocomplete: '='
        },
        controller: 'FormController'
    };
});

app.directive('targetImportForm', function () {
    return {
        templateUrl: 'directives/target-import-form.html',
        scope: {
            target: '=',
        },
        controller: 'FormController'
    };
});

app.directive('loading', function() {
    return {
        template: '<div class="lds-ring"><div></div><div></div><div></div><div></div></div>'
    }
})