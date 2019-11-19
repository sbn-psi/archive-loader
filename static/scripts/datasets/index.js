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
                    return $http.get('./edit/datasets', { params: { logical_identifier: $stateParams.edit }}).then(function(res) { return res.data.object })
                } else {
                    return null
                }
            },
            tags: function($http) {
                return $http.get('./tags/datasets').then(result => result.data)
            },
            tools: function($http) {
                return $http.get('./status/tools').then(result => result.data)
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
});

import DatasetLoaderController from './DatasetLoaderController.js';
import DatasetImportController from './DatasetImportController.js'
import DatasetManageController from './DatasetManageController.js'

app.controller('DatasetLoaderController', DatasetLoaderController);
app.controller('DatasetImportController', DatasetImportController);
app.controller('DatasetManageController', DatasetManageController);

app.directive('datasetImportForm', function () {
    return {
        templateUrl: 'directives/dataset-import-form.html',
        scope: {
            dataset: '=',
            type: '<',
            tags: '=',
            autocomplete: '='
        },
        controller: 'FormController'
    };
});
