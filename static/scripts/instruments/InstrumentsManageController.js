export default function($scope, $http, $state) {
    $http.get('./instruments/status').then(function(res) {
        $scope.status = res.data;
    }, function(err) {
        $scope.state.error = err;
    })

    $scope.edit = function(lidvid) {
        $state.go('instruments.import', {edit: lidvid})
    }
}