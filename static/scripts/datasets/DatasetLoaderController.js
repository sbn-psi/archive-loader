export default function ($scope, $http, constants) {
    const harvestUrl = './datasets/harvest';
    const ingest = './solr/harvest';

    $scope.fetch = function () {
        $scope.state.error = null;
        $scope.state.harvestResponse = null;
        if($scope.state.datasetUrl) {
            const options = { params: {
                url: $scope.state.datasetUrl
            }}

            $http.get(harvestUrl, options).then(function (res) {
                $scope.state.harvestResponse = res.data;
                $scope.state.loading = false;
            }, function(err) {
                $scope.state.loading = false;
                $scope.state.error = err.data;
            })
            $scope.state.loading = true;
        }
    };

    $scope.confirm = function () {
        if($scope.state.harvestResponse) {
            $scope.state.error = null;
            // user confirmed that we want to ingest these datasets into our solr registry

            // send the harvested xml to the ingest endpoint
            $http.post(ingest, { xml: $scope.state.harvestResponse.harvestOutput } ).then(function (res) {
                // move onto the next step, customizing the datasets

                // these are the datasets we are going to be working with
                $scope.state.datasets = {
                    bundle: $scope.state.harvestResponse.bundle,
                    collections: $scope.state.harvestResponse.collections
                }
                $scope.state.loading = false;
                $scope.state.harvestResponse = null;
                $scope.state.progress();
            }, function(err) {
                $scope.state.error = err.data;
                $scope.state.loading = false;
            })
        }
    };
}