export default function($scope) {
    let config = {
        modelName: 'mission',
        lidPrefix: 'urn:nasa:pds:context:investigation:',
        requiredFields: ['logical_identifier', 'display_name', 'display_description', 'start_date'],
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
        relationshipModelNames: ['target'],
        relationshipTransformer: function(relationship, domain) {
            return {
                investigation: $scope.model.mission.logical_identifier,
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