export default function($scope) {
    let config = {
        modelName: 'mission',
        requiredFields: ['logical_identifier', 'display_name', 'display_description'],
        primaryPostEndpoint: './save/missions',
        lookupReplacements: [
            {
                formField: 'display_name',
                registryField: 'investigation_name'
            },
            {
                formField: 'display_description',
                registryField: 'investigation_description'
            },
        ],
        relationshipModelNames: [],
        relationshipTransformer: function(relationship) {
            return null
        }
    }
    Object.assign($scope.config, config)
}