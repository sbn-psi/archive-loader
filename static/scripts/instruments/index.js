app.config(function($stateProvider) {
    $stateProvider.state({
        name: 'instruments',
        url: '/Instruments',
        redirectTo: 'instruments.manage'
    })
    $stateProvider.state({
        name: 'instruments.import',
        url: '/Import?edit',
        templateUrl: 'states/instruments/import.html',
        params: { edit: null },
        data: {
            title: 'Add Instrument'
        },
        resolve: {
            existing: function($http, $stateParams) {
                if(!!$stateParams.edit) {
                    return $http.get('./instruments/edit', { params: { logical_identifier: $stateParams.edit }}).then(function(res) { return res.data })
                } else {
                    return null
                }
            },
            tags: function($http) {
                return $http.get('./instruments/tags').then(result => result.data)
            },
            instrumentRelationships: function($http) {
                return $http.get('./relationship-types/instrument').then(result => result.data)
            },
            targetRelationships: () => null
        },
        controller: 'ContextObjectImportController'
    })
    $stateProvider.state({
        name: 'instruments.manage',
        url: '/Manage',
        templateUrl: 'states/instruments/manage.html',
        data: {
            title: 'Manage Instruments'
        }
    })
})

import InstrumentImportController from './InstrumentImportController.js';
import InstrumentsManageController from './InstrumentsManageController.js';

app.controller('InstrumentImportController', InstrumentImportController);
app.controller('InstrumentsManageController', InstrumentsManageController);

app.directive('instrumentImportForm', function () {
    return {
        templateUrl: 'directives/instrument-import-form.html',
        scope: {
            instrument: '=',
            tags: '='
        },
        controller: 'FormController'
    };
});