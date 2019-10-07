app.config(function($stateProvider) {
    $stateProvider.state({
        name: 'tools',
        url: '/Tools',
        redirectTo: 'tools.relationships'
    })
    $stateProvider.state({
        name: 'tools.relationships',
        url: '/Relationships',
        templateUrl: 'states/tools/relationships.html',
        data: {
            title: 'Manage Relationships'
        },
        resolve: {
            types: function($http) {
                return $http.get('/relationship-types/target').then(res => res.data)
            }
        },
        controller: function ManageRelationshipsController($scope, $http, types) {
            $scope.relationships = {
                types: types,
                saveState: function() {
                    const rels = $scope.relationships.types
                    const newrels = rels.sort((rel1,rel2) => rel1.order > rel2.order).map((rel,idx) => {
                        rel.order = idx + 1
                        return rel
                    })
                    $http.post('/relationship-types/target',newrels)
                },
                addRelationship: function() {
                    const newRelationship = {
                        name: $scope.relationships.newType,
                        order: $scope.relationships.types.length + 1,
                    }
                    $scope.relationships.types.push(newRelationship)
                    $scope.relationships.newType = ''
                },
                removeRelationship: function(id) {
                    // TODO: finish this feature
                    console.log('remove ' + id)
                },
            }
            $scope.$watch('relationships.types',$scope.relationships.saveState,true)
        }
    })
})