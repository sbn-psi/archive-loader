app.config(function($stateProvider) {
    $stateProvider.state({
        name: 'spacecraft',
        url: '/Spacecraft',
        redirectTo: 'spacecraft.manage'
    })
    $stateProvider.state({
        name: 'spacecraft.import',
        url: '/Import?edit',
        templateUrl: 'states/spacecraft/import.html',
        params: { edit: null },
        data: {
            title: 'Add Spacecraft'
        },
        resolve: {
            existing: function($http, $stateParams) {
                if(!!$stateParams.edit) {
                    return $http.get('./spacecraft/edit', { params: { logical_identifier: $stateParams.edit }}).then(function(res) { return res.data[0] })
                } else {
                    return null
                }
            },
            tags: function($http) {
                return $http.get('./spacecraft/tags').then(result => result.data)
            }
        },
        controller: 'SpacecraftImportController'
    })
    $stateProvider.state({
        name: 'spacecraft.manage',
        url: '/Manage',
        templateUrl: 'states/spacecraft/manage.html',
        data: {
            title: 'Manage Spacecraft'
        }
    })
})

import SpacecraftImportController from './SpacecraftImportController.js';
import SpacecraftManageController from './SpacecraftManageController.js';

app.controller('SpacecraftImportController', SpacecraftImportController);
app.controller('SpacecraftManageController', SpacecraftManageController);

app.directive('spacecraftImportForm', function () {
    return {
        templateUrl: 'directives/spacecraft-import-form.html',
        scope: {
            spacecraft: '=',
            tags: '=',
            error: '='
        },
        controller: 'FormController'
    };
});