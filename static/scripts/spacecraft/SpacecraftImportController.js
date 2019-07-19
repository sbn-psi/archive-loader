export default function($scope, $http, existing, sanitizer, lidCheck, isPopulated) {
    
    const templateModel = function() {
        return {}
    }
    $scope.model = {
        spacecraft: existing ? existing : templateModel()
    }

    $scope.submit = function() {
        if(validate()) {
            $scope.state.error = null;
            $scope.state.loading = true;            
            let postable = sanitizer($scope.model.spacecraft, templateModel)

            $http.post('./spacecraft/add', postable).then(function(res) {
                $scope.state.progress();
                $scope.state.loading = false;
            }, function(err) {
                $scope.state.error = 'There was a problem';
                $scope.state.loading = false;
                console.log(err);
            })
        } else {
            $scope.state.error = 'Spacecraft was invalid';
        }
    }

    $scope.$watch('model.spacecraft.logical_identifier', function() {
        if(!!existing) { return }
        $scope.state.loading = true;
        lidCheck($scope.model.spacecraft.logical_identifier).then(function(doc) {
            $scope.state.loading = false;
            const replace = (scopeKey, docKey) => {
                if(!isPopulated($scope.model.spacecraft[scopeKey])) { $scope.model.spacecraft[scopeKey] = doc[docKey][0] }
            }
            replace('display_name', 'instrument_host_name')
            replace('display_description', 'instrument_host_description')
        }, function(err) { 
            $scope.state.loading = false;
            // don't care about errors
        })
    })

    const validate = function() {
        return  isPopulated($scope.model.spacecraft.logical_identifier) &&
                isPopulated($scope.model.spacecraft.display_name) &&
                isPopulated($scope.model.spacecraft.display_description)
    }
}