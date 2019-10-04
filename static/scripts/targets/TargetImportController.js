export default function($scope, $http, existing, tags, sanitizer, prepForForm, lidCheck, isPopulated, targetRelationships) {
    let config = {
        modelName: 'target',
        requiredFields: ['logical_identifier', 'display_name', 'display_description', 'image_url'],
        primaryPostEndpoint: './targets/add',
        submitError: 'Target was invalid',
        lookupReplacements: [
            {
                formField: 'display_name',
                registryField: 'target_name'
            },
            {
                formField: 'display_description',
                registryField: 'target_description'
            },
        ],
        relationshipModelNames: ['spacecraft'],
        relationshipTransformer: function(relationship) {
            return {
                target: $scope.model.target.logical_identifier,
                instrument_host: relationship.lid,
                group: relationship.type
            }
        }
    }
    Object.assign($scope.config, config)
    

    $scope.lol = function() {
        if(validate()) {
            $scope.state.error = null;
            $scope.state.loading = true;            
            let postableTarget = sanitizer($scope.model.target, templateModel)
            let targetPost = $http.post('./targets/add', postableTarget)

            let postableRelationships = $scope.model.spacecraft.map(rel => { return {
                target: postableTarget.logical_identifier,
                instrument_host: rel.lid,
                group: rel.type
            }})
            let relationshipsPost = $http.post('./relationships/add', postableRelationships)

            Promise.all([targetPost, relationshipsPost]).then(function(res) {
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
}