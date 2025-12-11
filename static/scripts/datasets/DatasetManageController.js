export default function($scope, $http, $state) {
    const load = () => {
        $http.get('./status/datasets').then(function(res) {
            let response = res.data;

            if(!response.results) {
                response.results = []
            }
            
            // response.results has the list of datasets
            // add some computed properties to show bundle/collection status
            response.results.forEach(dataset => {
                if(dataset.lid && dataset.lid.split(':').length === 7) { // a lidvid with a collection will have 6 colons, thus 7 parts
                    dataset.is_bundle = false
                    dataset.bundle_lid = dataset.lid.split(':').slice(0,4).join(':')
                } else {
                    dataset.is_bundle = true
                    dataset.bundle_lid = dataset.lid.split('::')[0]
                    dataset.context = (dataset.context && dataset.context.split('_').length > 1) ? 
                        dataset.context.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                        : 'Missing Context!'
                }
            })
            $scope.fullResults = response.results;
            $scope.filteredResults = $scope.fullResults.filter(item => item.is_bundle);

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

    $scope.$watch('state.showCollections', show => {
        if(!show) {
            $scope.filteredResults = $scope.fullResults?.filter(item => item.is_bundle);
        } else {
            $scope.filteredResults = $scope.fullResults;
        }
    })

    $scope.state.showCollections = false;
}