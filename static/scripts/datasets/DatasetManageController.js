export default function($scope, $http, $state) {
    $http.get('./status/datasets').then(function(res) {
        $scope.status = res.data;
    }, function(err) {
        $scope.state.error = err;
    })

    $scope.edit = function(lidvid) {
        $state.go('datasets.import', {edit: lidvid})
    }
}