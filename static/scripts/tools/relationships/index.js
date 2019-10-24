const getTargetRelationships = $http => $http.get('./relationship-types/target').then(res => res.data)
const getInstrumentRelationships = $http => $http.get('./relationship-types/instrument').then(res => res.data)

app.config(function($stateProvider) {
    $stateProvider.state({
        name: 'relationships',
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
                        'save': './relationship-types/target',
                        'remove': './relationship-types/target/remove',
                    },
                    instrument: {
                        'get': null,
                        'save': './relationship-types/instrument',
                        'remove': './relationship-types/instrument/remove',
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
                savingTargets: false,
                savingInstruments: false,
            }
        }
    })
})

app.directive('relationshipRow', () => {
    return {
        templateUrl: 'directives/relationship-row.html'
    }
})

app.directive('relationshipsForm', () => {
    return {
        templateUrl: 'directives/relationships-form.html',
        scope: {
            relationshipType: '=',
            types: '=',
            savingState: '=',
            relationshipEndpoints: '=',
            cb: '=',
        },
        controller: function($scope,$http) {
            const cb = $scope.cb
            const endpoints = $scope.relationshipEndpoints
            
            $scope.groups = {
                always: [],
                sometimes: [],
                never: [],
            }
            
            $scope.$watch('types',types => {
                $scope.groups = {
                    always: [],
                    sometimes: [],
                    never: [],
                }
                types.map(type => {
                    if (type.order < 100) {
                        $scope.groups.always.push(type)
                    } else if (100 <= type.order && type.order < 1000) {
                        $scope.groups.sometimes.push(type)
                    } else {
                        $scope.groups.never.push(type)
                    }
                })
            })
            
            $scope.relationships = {
                removing: null,
                add: function() {
                    const {name,group} = $scope.relationships.new
                    
                    $scope.groups[group].push({name})
                    
                    $scope.relationships.save()
                    $scope.relationships.new = {name:null,group:'never'}
                },
                
                new: {
                    name: null,
                    group: 'never',
                },
                
                modifyingRelationship: null,
                
                editing: type => (!$scope.relationships.modifyingRelationship) ? false : type.relationshipId === $scope.relationships.modifyingRelationship.relationshipId,
                
                modifyRelationship: function(doc) {
                    if (doc === null) {
                        $scope.relationships.modifyingRelationship = null
                    } else {
                        $scope.relationships.modifyingRelationship = doc
                        setTimeout(() => $(`#${doc.relationshipId}`).focus(),75)
                    }
                },
                
                save: function() {
                    $scope.savingState = true;

                    function offset(type,idx,groupOffset) {
                        type.order = idx + groupOffset
                        return type
                    }

                    const groups = $scope.groups
                    console.log(groups.always[0].name);
                    console.log(groups.always[1].name);
                    console.log(groups.always[2].name);
                    
                    const _always = groups.always.map((type,idx) => offset(type,idx,0))
                    const _sometimes = groups.sometimes.map((type,idx) => offset(type,idx,100))
                    const _never = groups.never.map((type,idx) => offset(type,idx,1000))
                    
                    const relationships = _always.concat(_sometimes,_never)
                    console.log(relationships);
                    
                    setTimeout(() => {
                        $http.post(endpoints.save,relationships).then(res => console.log(res)).finally(() => {
                            cb($http).then(res => {
                                $scope.savingState = false;
                                $scope.relationships.modifyRelationship(null)
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
            
            $scope.options = {
                target: {
                    connectWith: '.sortable',
                    stop: $scope.relationships.save,
                },
                instrument: {
                    connectWith: '.sortable',
                    stop: $scope.relationships.save,
                }
            }
        }
    }
})