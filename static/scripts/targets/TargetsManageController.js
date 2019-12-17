export default function($scope, $http, $state) {
    $http.get('./status/targets').then(function(res) {
        $scope.status = res.data;
    }, function(err) {
        $scope.state.error = err;
    })

    $scope.edit = function(lidvid) {
        return $state.href('targets.import', {edit: lidvid})
    }
}