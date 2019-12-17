export default function($scope, $http, $state) {
    $http.get('./status/instruments').then(function(res) {
        $scope.status = res.data;
    }, function(err) {
        $scope.state.error = err;
    })

    $scope.edit = function(lidvid) {
        return $state.href('instruments.import', {edit: lidvid})
    }
}