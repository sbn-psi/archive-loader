var app = angular.module('app', []);

app.controller('RootController', function($scope) {
    $scope.state = {
        name: 'Loader',
        datasetType: 'Bundle',
        progress: function() {
            $scope.state.name = 'Import';
        }
    };
});

app.controller('LoaderController', function ($scope, $http) {
    const collectionCheckUrl = '/check/collection';
    const bundleCheckUrl = '/check/bundle';

    $scope.fetch = function () {
        // normally, we would just go fetch
        if($scope.state.datasetUrl) {
            let url = $scope.state.datasetType == 'Bundle' ? bundleCheckUrl : collectionCheckUrl;
            $http.get(url).then(function (res) {
                $scope.state.datasets = res.data;
                $scope.state.progress();
            })
        }
    };
});

app.controller('ImportController', function($scope, $http) {
    $scope.$watch('view.active', function(newVal) {
        if(newVal && !newVal.logical_identifier) {
            prepDataset(newVal)
        }
    })

    const prepDataset = function(dataset) {
        const template = templateModel()
        Object.assign(dataset, template)
        dataset.logical_identifier = dataset.lidvid
        dataset.display_name = dataset.name
        dataset.display_description = dataset.abstract
        dataset.browse_url = dataset.browseUrl
    }

    $scope.model = {
        bundle: $scope.state.datasets.bundle,
        collections: $scope.state.datasets.collections
    }

    $scope.view = {
        active: $scope.model.bundle ? $scope.model.bundle : $scope.model.collections[0],
        type: $scope.model.bundle ? 'Bundle' : 'Collection'
    }

    $scope.submit = function() {
        $http.post('/add', {
            bundle: sanitize($scope.model.bundle),
            collections: $scope.model.collections.map(c => sanitize(c))
        }).then(function(res) {
            console.log(res);
        }, function(err) {
            console.log(err);
        })
    }

    const sanitize = function(dataset) {
        let sanitized = templateModel()
        for (const [key, value] of Object.entries(dataset)) {
            if (dataset.hasOwnProperty(key) && !key.startsWith('$$')) {
                if(value.constructor === Array) {
                    let trimmed = value.filter(item => !item.isEmpty())
                    sanitized[key] = trimmed;
                } else {
                    sanitized[key] = value;
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

app.directive('importForm', function () {
    return {
        templateUrl: '/import.html',
        scope: {
            dataset: '=',
            type: '<'
        },
        link: function($scope) {
            $scope.groupRepeater = function(array) {
                if(array.length === 0 || !array.last().isEmpty()) {
                    array.push({})
                }
                return array;
            }
        }
    };
});