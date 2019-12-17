export default function($scope, $http, $state) {
    $http.get('./status/spacecraft').then(function(res) {
        $scope.status = res.data;
    }, function(err) {
        $scope.state.error = err;
    })

    $scope.edit = function(lidvid) {
        return $state.href('spacecraft.import', {edit: lidvid})
    }
}