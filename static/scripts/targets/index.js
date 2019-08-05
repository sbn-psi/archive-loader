app.config(function($stateProvider) {
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
            existing: function($http, $stateParams) {
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
    $stateProvider.state({
        name: 'targets.relate',
        url: '/Relate',
        templateUrl: 'states/targets/relate.html',
        data: {
            title: 'Relate Targets'
        }
    })
})

import TargetImportController from './TargetImportController.js';
import TargetsManageController from './TargetsManageController.js';
import TargetRelationshipsController from './TargetRelationshipsController.js';

app.controller('TargetImportController', TargetImportController);
app.controller('TargetsManageController', TargetsManageController);
app.controller('TargetRelationshipsController', TargetRelationshipsController);

app.directive('targetImportForm', function () {
    return {
        templateUrl: 'directives/target-import-form.html',
        scope: {
            target: '=',
        },
        controller: 'FormController'
    };
});


