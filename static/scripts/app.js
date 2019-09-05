var app = angular.module('app', ['ui.bootstrap', 'ui.router', 'textAngular', 'ngFileUpload']);

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
                case 'missions.import': $state.go('missions.manage'); break;
                case 'missions.manage': $state.go('missions.import'); break;
                case 'spacecraft.import': $state.go('spacecraft.manage'); break;
                case 'spacecraft.manage': $state.go('spacecraft.import'); break;
                case 'instruments.import': $state.go('instruments.manage'); break;
                case 'instruments.manage': $state.go('instruments.import'); break;
            }
        },
        loading: false,
        error: null,
        alerts: []
    };

    $scope.constants = constants;
    $state.go('root');
});


