export default function($scope, $http, existing, tags, sanitizer, prepForForm, lidCheck, isPopulated) {
    $scope.tags = tags
    
    const templateModel = function() {
        return {
            tags: [],
        }
    }
    $scope.model = {
        target: existing ? prepForForm(existing, templateModel) : templateModel()
    }
    $scope.submit = function() {
        if(validate()) {
            $scope.state.error = null;
            $scope.state.loading = true;            
            let postable = sanitizer($scope.model.target, templateModel)

            $http.post('./targets/add', postable).then(function(res) {
                $scope.state.progress();
                $scope.state.loading = false;
            }, function(err) {
                $scope.state.error = err.data;
                $scope.state.loading = false;
                console.log(err);
            })
        } else {
            $scope.state.error = 'Target was invalid';
        }
    }

    
    $scope.$watch('model.target.logical_identifier', function() {
        if(!!existing) { return }
        $scope.state.loading = true;
        lidCheck($scope.model.target.logical_identifier).then(function(doc) {
            $scope.state.loading = false;
            const replace = (scopeKey, docKey) => {
                if(!isPopulated($scope.model.target[scopeKey])) { $scope.model.target[scopeKey] = doc[docKey][0] }
            }
            replace('display_name', 'target_name')
            replace('display_description', 'target_description')
        }, function(err) { 
            $scope.state.loading = false;
            // don't care about errors
        })
    })

    const validate = function() {
        return  isPopulated($scope.model.target.logical_identifier) &&
                isPopulated($scope.model.target.display_name) &&
                isPopulated($scope.model.target.display_description) &&
                isPopulated($scope.model.target.image_url)
    }
}