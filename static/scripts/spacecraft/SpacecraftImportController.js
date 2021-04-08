export default function($scope) {
    let config = {
        modelName: 'spacecraft',
        lidPrefix: 'urn:nasa:pds:context:instrument_host:',
        requiredFields: ['logical_identifier', 'display_name'],
        primaryPostEndpoint: './save/spacecraft',
        lookupReplacements: [
            {
                formField: 'display_name',
                registryField: 'instrument_host_name'
            }
        ],
        relationshipModelNames: ['instrument'],
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