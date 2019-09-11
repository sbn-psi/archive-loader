export default function($scope, $http, existing, tags, sanitizer, prepForForm, lidCheck, isPopulated) {
    $scope.tags = tags
    
    const templateModel = function() {
        return {
            tags: [],
        }
    }
    
    $scope.model = {
        mission: existing ? prepForForm(existing, templateModel) : templateModel()
    }

    $scope.submit = function() {
        if(validate()) {
            $scope.state.error = null;
            $scope.state.loading = true;            
            let postable = sanitizer($scope.model.mission, templateModel)

            $http.post('./missions/add', postable).then(function(res) {
                $scope.state.progress();
                $scope.state.loading = false;
            }, function(err) {
                $scope.state.error = 'There was a problem';
                $scope.state.loading = false;
                console.log(err);
            })
        } else {
            $scope.state.error = 'Mission was invalid';
        }
    }

    $scope.$watch('model.mission.logical_identifier', function() {
        if(!!existing) { return }
        $scope.state.loading = true;
        lidCheck($scope.model.mission.logical_identifier).then(function(doc) {
            $scope.state.loading = false;
            const replace = (scopeKey, docKey) => {
                if(!isPopulated($scope.model.mission[scopeKey])) { $scope.model.mission[scopeKey] = doc[docKey][0] }
            }
            replace('display_name', 'investigation_name')
            replace('display_description', 'investigation_description')
        }, function(err) { 
            $scope.state.loading = false;
            // don't care about errors
        })
    })

    const validate = function() {
        return  isPopulated($scope.model.mission.logical_identifier) &&
                isPopulated($scope.model.mission.display_name) &&
                isPopulated($scope.model.mission.display_description)
    }
}