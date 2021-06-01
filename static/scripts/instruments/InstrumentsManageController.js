export default function($scope, $http, $state) {
    const load = () => {
        $http.get('./status/instruments').then(function(res) {
            $scope.status = res.data;
        }, function(err) {
            $scope.state.error = err;
        })
    }
    load()

    $scope.edit = function(lidvid) {
        return $state.href('instruments.import', {edit: lidvid})
    }

    $scope.delete = function(item) {
        if(confirm("Delete " + item.name + "?")) {
            $http.delete('./delete/instrument/' + item.lid).then(load, error => {
                $scope.state.error = error.data
            })
        }
    }
}