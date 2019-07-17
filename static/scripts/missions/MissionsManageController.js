export default function($scope, $http, $state) {
    $http.get('./missions/status').then(function(res) {
        $scope.status = res.data;
    }, function(err) {
        $scope.state.error = err;
    })

    $scope.edit = function(lidvid) {
        $state.go('missions.import', {edit: lidvid})
    }
}