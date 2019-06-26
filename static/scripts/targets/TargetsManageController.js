export default function($scope, $http, $state) {
    $http.get('./targets/status').then(function(res) {
        $scope.status = res.data;
    }, function(err) {
        $scope.state.error = err;
    })

    $scope.edit = function(lidvid) {
        $state.go('targets.import', {edit: lidvid})
    }
}