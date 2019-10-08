const getTargetRelationships = $http => $http.get('/relationship-types/target').then(res => res.data)
const getInstrumentRelationships = $http => $http.get('/relationship-types/instrument').then(res => res.data)

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
            targetTypes: getTargetRelationships,
            instrumentTypes: getInstrumentRelationships,
            endpoints: function() {
                return {
                    target: {
                        'get': null,
                        'save': '/relationship-types/target',
                        'remove': '/relationship-types/target/remove',
                    },
                    instrument: {
                        'get': null,
                        'save': '/relationship-types/instrument',
                        'remove': '/relationship-types/instrument/remove',
                    },
                }
            }
        },
        controller: function ManageRelationshipsController($scope, $http, targetTypes, instrumentTypes, endpoints) {
            $scope.relationships = {
                endpoints: endpoints,
                targetTypes: targetTypes,
                instrumentTypes: instrumentTypes,
                getTargetRelationships: getTargetRelationships,
                getInstrumentRelationships: getInstrumentRelationships,
            }
        }
    })
})

app.directive('relationshipsForm', () => {
    return {
        templateUrl: 'directives/relationships-form.html',
        scope: {
            types: '=',
            savingState: '=',
            relationshipEndpoints: '=',
            cb: '=',
        },
        controller: function($scope,$http) {
            const cb = $scope.cb
            const endpoints = $scope.relationshipEndpoints;
            $scope.relationships = {
                removing: null,
                addRelationship: function() {
                    const newRelationship = {
                        name: $scope.relationships.newType,
                        order: $scope.types.length + 1,
                    }
                    $scope.types.push(newRelationship)
                    $scope.relationships.newType = ''
                },
                saveState: function(types) {
                    if (!types || !types.length) return $scope.types = [];
                    else if (!endpoints) return;
                    
                    $scope.savingState = true;
                    const rels = $scope.types
                    const newrels = rels.sort((rel1,rel2) => rel1.order > rel2.order).map((rel,idx) => {
                        rel.order = idx + 1
                        return rel
                    })
                    setTimeout(() => {
                        $http.post(endpoints.save,newrels).finally(() => {
                            cb($http).then(res => {
                                $scope.types = res
                                $scope.savingState = false;
                            })
                        })
                    }, 800)
                },
                removeRelationship: function(doc) {
                    $scope.relationships.removing = doc.relationshipId;
                    setTimeout(() => {
                        $http.post(endpoints.remove,doc).then(res => {
                            cb($http).then(res => {
                                $scope.types = res
                                $scope.relationships.removing = null;
                            })
                        })
                    },800)
                },
            }
            $scope.$watch('types',$scope.relationships.saveState,true)
        }
    }
})