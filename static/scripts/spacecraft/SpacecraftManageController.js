export default function($scope, $http, $state) {
    const load = () => {
        $http.get('./status/spacecraft').then(function(res) {
            $scope.status = res.data;
        }, function(err) {
            $scope.state.error = err;
        })
    }
    load()

    $scope.sref = function(lidvid) {
        return $state.href('spacecraft.import', {edit: lidvid})
    }

    $scope.delete = function(item) {
        if(confirm("Delete " + item.name + "?")) {
            $http.delete('./delete/spacecraft/' + item.lid).then(load, error => {
                $scope.state.error = error.data
            })
        }
    }
}