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
                    return $http.get('./edit/target', { params: { logical_identifier: $stateParams.edit }}).then(function(res) { return res.data })
                } else {
                    return null
                }
            },
            tags: function($http) {
                return $http.get('./tags/targets').then(result => result.data?.map(tag => tag.name))
            },
            targetRelationships: function($http) {
                return $http.get('./relationship-types/target').then(result => result.data)
            },
            instrumentRelationships: () => null,
            tools: function($http) {
                return $http.get('./status/tools').then(result => result.data)
            }
        },
        controller: 'ContextObjectImportController'
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
    $stateProvider.state({
        name: 'targets.tags',
        url: '/Tags',
        templateUrl: 'states/targets/tags.html',
        data: {
            title: 'Manage Tags'
        }
    })
})

import TargetImportController from './TargetImportController.js';
import TargetsManageController from './TargetsManageController.js';
import TargetTagsManageController from './TargetTagsManageController.js';
import TargetRelationshipsController from './TargetRelationshipsController.js';

app.controller('TargetImportController', TargetImportController);
app.controller('TargetsManageController', TargetsManageController);
app.controller('TargetTagsManageController', TargetTagsManageController);
app.controller('TargetRelationshipsController', TargetRelationshipsController);

app.directive('targetImportForm', function () {
    return {
        templateUrl: 'directives/target-import-form.html',
        scope: {
            target: '=',
            tags: '=',
            error: '='
        },
        controller: 'FormController'
    };
});


