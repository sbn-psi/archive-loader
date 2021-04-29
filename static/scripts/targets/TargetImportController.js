export default function($scope) {
    let config = {
        modelName: 'target',
        lidPrefix: 'urn:nasa:pds:context:target:',
        requiredFields: ['logical_identifier', 'display_name', 'display_description'],
        primaryPostEndpoint: './save/targets',
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
        relationshipModelNames: ['mission'],
        relationshipTransformer: function(relationship) {
            return {
                target: $scope.model.target.logical_identifier,
                investigation: relationship.lid,
                relationshipId: relationship.relationshipId
            }
        },
        relationshipUnpacker: function(arr, relationship) {
            if(!relationship.investigation) { return arr }
            return arr.concat({
                lid: relationship.investigation,
                relationshipId: relationship.relationshipId
            })
        }
    }
    Object.assign($scope.config, config)
}