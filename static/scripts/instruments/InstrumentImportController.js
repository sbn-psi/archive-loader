export default function($scope, $http, existing, tags, sanitizer, prepForForm, lidCheck, isPopulated) {
    $scope.tags = tags
    
    const templateModel = function() {
        return {
            tags: [],
        }
    }
    $scope.model = {
        instrument: existing ? prepForForm(existing, templateModel) : templateModel()
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

    $scope.$watch('model.instrument.logical_identifier', function() {
        if(!!existing) { return }
        $scope.state.loading = true;
        lidCheck($scope.model.instrument.logical_identifier).then(function(doc) {
            $scope.state.loading = false;
            const replace = (scopeKey, docKey) => {
                if(!isPopulated($scope.model.instrument[scopeKey])) { $scope.model.instrument[scopeKey] = doc[docKey][0] }
            }
            replace('display_name', 'instrument_name')
            replace('display_description', 'instrument_description')
        }, function(err) { 
            $scope.state.loading = false;
            // don't care about errors
        })
    })


    const validate = function() {
        return  isPopulated($scope.model.instrument.logical_identifier) &&
                isPopulated($scope.model.instrument.display_name) &&
                isPopulated($scope.model.instrument.display_description)
    }
}