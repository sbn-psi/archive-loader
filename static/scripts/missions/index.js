app.config(function($stateProvider) {
    $stateProvider.state({
        name: 'missions',
        url: '/Missions',
        redirectTo: 'missions.manage'
    })
    $stateProvider.state({
        name: 'missions.import',
        url: '/Import?edit',
        templateUrl: 'states/missions/import.html',
        params: { edit: null },
        data: {
            title: 'Add Mission'
        },
        resolve: {
            existing: function($http, $stateParams) {
                if(!!$stateParams.edit) {
                    return $http.get('./edit/mission', { params: { logical_identifier: $stateParams.edit }}).then(function(res) { return res.data })
                } else {
                    return null
                }
            },
            tags: function($http) {
                return $http.get('./tags/missions').then(result => result.data?.map(tag => tag.name))
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
        name: 'missions.manage',
        url: '/Manage',
        templateUrl: 'states/missions/manage.html',
        data: {
            title: 'Manage Missions'
        }
    })
})

import MissionImportController from './MissionImportController.js';
import MissionsManageController from './MissionsManageController.js';

app.controller('MissionImportController', MissionImportController);
app.controller('MissionsManageController', MissionsManageController);

app.directive('missionImportForm', function () {
    return {
        templateUrl: 'directives/mission-import-form.html',
        scope: {
            mission: '=',
            tags: '=',
            error: '='
        },
        controller: 'FormController'
    };
});