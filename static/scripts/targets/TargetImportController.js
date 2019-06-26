export default function($scope, $http, existingTarget, sanitizer) {
    
    const templateModel = function() {
        console.log(existingTarget)
        return {
            tags: [],
            related_targets: [],
            missions: [],
        }
    }
    $scope.model = {
        target: existingTarget ? existingTarget : templateModel()
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
                $scope.state.error = 'There was a problem';
                $scope.state.loading = false;
                console.log(err);
            })
        } else {
            $scope.state.error = 'Target was invalid';
        }
    }

    const validate = function() {
        const isPopulated = (val) => val && val.length > 0
        return  isPopulated($scope.model.target.logical_identifier) &&
                isPopulated($scope.model.target.display_name) &&
                isPopulated($scope.model.target.display_description) &&
                isPopulated($scope.model.target.image_url) &&
                isPopulated($scope.model.target.category)
    }
}