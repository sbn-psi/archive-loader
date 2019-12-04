export default function($scope) {
    let config = {
        modelName: 'instrument',
        lidPrefix: 'urn:nasa:pds:context:instrument:',
        requiredFields: ['logical_identifier', 'display_name', 'display_description'],
        primaryPostEndpoint: './save/instruments',
        lookupReplacements: [
            {
                formField: 'display_name',
                registryField: 'instrument_name'
            },
            {
                formField: 'display_description',
                registryField: 'instrument_description'
            },
        ],
        relationshipModelNames: ['spacecraft'],
        relationshipTransformer: function(relationship) {
            return {
                instrument: $scope.model.instrument.logical_identifier,
                instrument_host: relationship.lid,
                relationshipId: relationship.relationshipId
            }
        },
        relationshipUnpacker: function(arr, relationship) {
            return arr.concat({            
                lid: relationship.instrument_host,
                relationshipId: relationship.relationshipId
            })
        }
    }
    Object.assign($scope.config, config)
}