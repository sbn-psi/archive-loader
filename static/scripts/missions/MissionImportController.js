export default function($scope, $http, existing, sanitizer) {
    
    const templateModel = function() {
        return {}
    }
    $scope.model = {
        mission: existing ? existing : templateModel()
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

    const validate = function() {
        const isPopulated = (val) => val && val.length > 0
        return  isPopulated($scope.model.mission.logical_identifier) &&
                isPopulated($scope.model.mission.display_name) &&
                isPopulated($scope.model.mission.display_description) &&
                isPopulated($scope.model.mission.image_url) &&
                isPopulated($scope.model.mission.funding_level)
    }
}