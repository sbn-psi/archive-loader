export default function($scope, $http, $state) {
    const load = () => {
        $http.get('./status/datasets').then(function(res) {
            $scope.status = res.data;
        }, function(err) {
            $scope.state.error = err;
        })
    }
    load()

    $scope.sref = function(lidvid) {
        return $state.href('datasets.import', {edit: lidvid})
    }

    $scope.delete = function(item) {
        if(confirm("Delete " + item.name + "?")) {
            $http.delete('./delete/dataset/' + item.lid).then(load, error => {
                $scope.state.error = error.data
            })
        }
    }
}