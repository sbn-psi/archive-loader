export default function($scope, $http, existing, sanitizer) {
    
    const templateModel = function() {
        return {}
    }
    $scope.model = {
        instrument: existing ? existing : templateModel()
    }

    $scope.submit = function() {
        if(validate()) {
            $scope.state.error = null;
            $scope.state.loading = true;            
            let postable = sanitizer($scope.model.instrument, templateModel)

            $http.post('./instruments/add', postable).then(function(res) {
                $scope.state.progress();
                $scope.state.loading = false;
            }, function(err) {
                $scope.state.error = 'There was a problem';
                $scope.state.loading = false;
                console.log(err);
            })
        } else {
            $scope.state.error = 'Instrument was invalid';
        }
    }

    const validate = function() {
        const isPopulated = (val) => val && val.length > 0
        return  isPopulated($scope.model.instrument.logical_identifier) &&
                isPopulated($scope.model.instrument.display_name) &&
                isPopulated($scope.model.instrument.display_description)
    }
}