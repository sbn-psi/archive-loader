export default function($scope) {
    let config = {
        modelName: 'instrument',
        lidFragment: ':context:instrument:',
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
        relationshipModelNames: ['spacecraft', 'bundle'],
        relationshipTransformer: function(relationship, domain) {
            return {
                instrument: $scope.model.instrument.logical_identifier,
                [domain === 'spacecraft' ? 'instrument_host' : domain]: relationship.lid,
                relationshipId: relationship.relationshipId,
                label: relationship.label
            }
        },
        relationshipUnpacker: function(arr, relationship, domain) {
            if(!relationship[domain]) return arr
            return arr.concat({            
                lid: relationship[domain === 'spacecraft' ? 'instrument_host' : domain],
                relationshipId: relationship.relationshipId,
                label: relationship.label
            })
        }
    }
    Object.assign($scope.config, config)
}