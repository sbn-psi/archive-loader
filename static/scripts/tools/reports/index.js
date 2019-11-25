
app.config(function($stateProvider) {
    $stateProvider.state({
        name: 'reports',
        url: '/Tools/Reports',
        templateUrl: 'states/tools/reports.html',
        data: {
            title: 'Reported issues'
        },
        resolve: {
            targetTypes: $http => $http.get('./relationship-types/target').then(res => res.data),
            instrumentTypes: $http => $http.get('./relationship-types/instrument').then(res => res.data),
            relationships: $http => $http.get('./status/relationships').then(res => res.data)
        },
        controller: function ManageRelationshipsController($scope, targetTypes, instrumentTypes, relationships) {
            let allRelationshipTypes = [...targetTypes, ...instrumentTypes].filter(type => type.order >= 1000)
            let hiddenRelationshipTypeIds = allRelationshipTypes.map(type => type.relationshipId)
            let problematicRelationships = relationships.filter(rel => hiddenRelationshipTypeIds.includes(rel.relationshipId))

            let model = {}
            allRelationshipTypes.forEach(rel => model[rel.name] = [])
            problematicRelationships.forEach(rel => {
                let relType = allRelationshipTypes.find(type => type.relationshipId === rel.relationshipId)
                model[relType.name].push(rel)
            })

            $scope.model = Object.keys(model).map(name => { return {name, relationships: model[name]}})
        }
    })
})
