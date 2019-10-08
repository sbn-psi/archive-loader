app.config(function($stateProvider) {
    const getTargetRelationships = $http => $http.get('/relationship-types/target').then(res => res.data);
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
            types: getTargetRelationships,
        },
        controller: function ManageRelationshipsController($scope, $http, types) {
            $scope.relationships = {
                types: types,
                savingState: false,
                saveState: function(types) {
                    if (!types || !types.length) return;
                    $scope.relationships.savingState = true;
                    const rels = $scope.relationships.types
                    const newrels = rels.sort((rel1,rel2) => rel1.order > rel2.order).map((rel,idx) => {
                        rel.order = idx + 1
                        return rel
                    })
                    setTimeout(() => {
                        $http.post('/relationship-types/target',newrels).finally(() => {
                            getTargetRelationships($http).then(res => {
                                $scope.relationships.types = res
                                $scope.relationships.savingState = false;
                            })
                        })
                    }, 800)
                },
                addRelationship: function() {
                    const newRelationship = {
                        name: $scope.relationships.newType,
                        order: $scope.relationships.types.length + 1,
                    }
                    $scope.relationships.types.push(newRelationship)
                    $scope.relationships.newType = ''
                },
                removeRelationship: function(doc) {
                    $scope.relationships.removing = doc.relationshipId;
                    setTimeout(() => {
                        $http.post('/relationship-types/target/remove',doc).then(res => {
                            getTargetRelationships($http).then(res => {
                                $scope.relationships.types = res
                                $scope.relationships.removing = null;
                            })
                        })
                    },800)
                },
            }
            $scope.$watch('relationships.types',$scope.relationships.saveState,true)
        }
    })
})