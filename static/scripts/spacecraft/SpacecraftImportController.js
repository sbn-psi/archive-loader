export default function($scope) {
    let config = {
        modelName: 'spacecraft',
        requiredFields: ['logical_identifier', 'display_name', 'display_description'],
        primaryPostEndpoint: './save/spacecraft',
        lookupReplacements: [
            {
                formField: 'display_name',
                registryField: 'instrument_host_name'
            },
            {
                formField: 'display_description',
                registryField: 'instrument_host_description'
            },
        ],
        relationshipModelNames: ['target', 'instrument'],
        relationshipTransformer: function(relationship, domain) {
            return {
                instrument_host: $scope.model.spacecraft.logical_identifier,
                [domain]: relationship.lid,
                relationshipId: relationship.relationshipId
            }
        },
        relationshipUnpacker: function(arr, relationship, domain) {
            if(!relationship[domain]) return arr
            return arr.concat({
                lid: relationship[domain],
                relationshipId: relationship.relationshipId
            })
        }
    }
    Object.assign($scope.config, config)
}