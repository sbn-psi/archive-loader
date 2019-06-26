var app = angular.module('app', ['ui.bootstrap', 'ui.router']);

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

app.directive('loading', function() {
    return {
        template: '<div class="lds-ring"><div></div><div></div><div></div><div></div></div>'
    }
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
});
