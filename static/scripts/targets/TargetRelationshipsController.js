export default function($scope, $http, $state) {
    const INITIAL = 'INITIAL', SPECIFYING = 'SPECIFYING', RELATING = 'RELATING', SAVING = 'SAVING'
    $scope.state.mode = INITIAL

    const refresh = () => { 
        $http.get('./target-relationships/status').then(function(res) {
            $scope.targets = res.data.targets;
            $scope.relationships = res.data.relationships;
        }, function(err) {
            $scope.state.error = err;
        })
    }
    refresh()

    $scope.select = function(target) {
        $scope.state.mode = SPECIFYING
        $scope.state.selectedTarget = target
    }

    $scope.$watch('state.relationship', function(val) {
        if(!!val) { 
            $scope.state.mode = RELATING
        }
    })

    $scope.relate = function(otherTarget) {
        $scope.state.mode = SAVING
        let {selectedTarget, relationship} = $scope.state
        let model = {}
        switch (relationship) {
            case 'parentOf':
                model = {
                    parent_ref: selectedTarget.lid,
                    child_ref: otherTarget.lid
                }; break;
            case 'childOf':
                model = {
                    parent_ref: otherTarget.lid,
                    child_ref: selectedTarget.lid
                }; break;
            case 'associated':
                model = {
                    associated_targets: [otherTarget.lid, selectedTarget.lid]
                }; break;
            default: cosole.log('invalid relationship'); return
        }

        $http.post('./target-relationships/add', model).then(function(res) {
            refresh()
            $scope.state.mode = INITIAL;
            $scope.state.relationship = null
        }, function(err) {
            $scope.state.error = err.data;
            console.log(err);
        })
    }

    $scope.childOf = function(target){
        return $scope.relationships.filter(rel => rel.child_ref === target.lid).map(rel => rel.parent_ref)
    }
    $scope.parentOf = function(target){
        return $scope.relationships.filter(rel => rel.parent_ref === target.lid).map(rel => rel.child_ref)
    }
    $scope.associatedTo = function(target){
        return $scope.relationships.filter(rel => rel.associated_targets ? rel.associated_targets.includes(target.lid) : false).map(rel => rel.associated_targets.find(tar => tar !== target.lid))
    }
}