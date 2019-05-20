var app = angular.module('app', ['ui.bootstrap']);

app.constant('states', {
    load: 'Loader',
    import: 'Import',
    manage: 'Manage'
}).constant('constants', {
    bundleType: 'Bundle',
    collectionType: 'Collection'
});

app.controller('RootController', function($scope, constants, states) {
    $scope.state = {
        name: states.load,
        datasetType: constants.bundleType,
        progress: function() {
            switch($scope.state.name) {
                case states.load: $scope.state.name = states.import; break;
                case states.import: $scope.state.name = states.manage; break;
            }
        },
        loading: false,
        error: null,
        alerts: []
    };

    $scope.constants = constants;
    $scope.states = states;
});

app.controller('LoaderController', function ($scope, $http, constants, states) {
    const collectionCheckUrl = './check/collection';
    const bundleCheckUrl = './check/bundle';

    $scope.viewStatus = function() {
        $scope.state.name = states.manage;
    }
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

app.controller('ImportController', function($scope, $http, constants) {
    $scope.allDatasets = function() {
        let themAll = [$scope.model.bundle];
        return themAll.concat($scope.model.collections);
    }

    const datasetHasBeenPrepped = function(dataset) {
        return !!(dataset && dataset.logical_identifier)
    }

    $scope.$watch('view.active', function(newVal) {
        if(!datasetHasBeenPrepped(newVal)) {
            prepDataset(newVal)
        }
    })

    const prepDataset = function(dataset) {
        if(dataset && dataset.constructor === Object) {
            const template = templateModel();
            Object.assign(dataset, template);
            dataset.logical_identifier = dataset.lidvid;
            dataset.display_name = dataset.name;
            dataset.display_description = dataset.abstract;
            dataset.browse_url = dataset.browseUrl;
        }
    }

    $scope.model = {
        bundle: $scope.state.datasets.bundle,
        collections: $scope.state.datasets.collections
    }

    $scope.view = {
        active: $scope.model.bundle ? $scope.model.bundle : $scope.model.collections[0],
        type: $scope.model.bundle ? constants.bundleType : constants.collectionType
    }

    $scope.autocomplete = function(model, current, parentObj) {
        let vals = [current];
        let fieldPool;
        if(!!parentObj) {
            fieldPool = $scope.allDatasets().reduce((pool, ds) => { 
                let item = ds[parentObj]; if(!item) { return pool };
                return item.constructor === Array ? pool.concat(item) : [...pool, item]
            }, [])
        } else {
            fieldPool = $scope.allDatasets();
        }
        return vals.concat(fieldPool.map(ds => ds[model]).filter(field => !!field).reduce((pool, item) => pool.includes(item) ? pool : [...pool, item], []))
    }

    $scope.submit = function() {
        if(validate()) {
            $scope.state.error = null;
            $scope.state.loading = true;            
            let postable = {
                bundle: sanitize($scope.model.bundle),
                collections: $scope.model.collections.map(c => sanitize(c))
            }
            $http.post('./add', postable).then(function(res) {
                $scope.state.progress();
                $scope.state.loading = false;
            }, function(err) {
                $scope.state.error = 'There was a problem';
                $scope.state.loading = false;
                console.log(err);
            })
        } else {
            $scope.state.error = 'Some datasets are invalid';
        }
    }

    const validate = function() {
        const isValid = function(dataset) {
            return datasetHasBeenPrepped(dataset);
        }
        return $scope.allDatasets().every(isValid);
    }

    const sanitize = function(dataset) {
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

        let sanitized = templateModel()
        for (const [key, value] of Object.entries(dataset)) {
            if (dataset.hasOwnProperty(key) && !key.startsWith('$$')) {
                if(value.constructor === Array) {
                    let trimmed = value.filter(item => !isEmptyObject(item)) 
                    sanitized[key] = trimmed;
                } else {
                    sanitized[key] = isEmptyObject(value) ? null : value;
                }
            }
        }
        if(sanitized.tags) {
            sanitized.tags = sanitized.tags.map(tag => tag.name)
        }

        delete sanitized.lidvid;
        delete sanitized.name;
        delete sanitized.abstract;
        delete sanitized.browseUrl;

        return sanitized
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
});

app.controller('ManageController', function($scope, $http, constants) {
    $http.get('./status').then(function(res) {
        $scope.status = res.data;
    }, function(err) {
        $scope.state.error = err;
    })
});

app.directive('importForm', function () {
    return {
        templateUrl: './import.html',
        scope: {
            dataset: '=',
            type: '<',
            autocomplete: '='
        },
        link: function($scope) {
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
        }
    };
});

app.directive('loading', function() {
    return {
        template: '<div class="lds-ring"><div></div><div></div><div></div><div></div></div>'
    }
})