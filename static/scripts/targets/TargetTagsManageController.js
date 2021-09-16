export default function($scope, $http, $state, $uibModal) {
    let groups
    const load = () => {
        $http.get('./tags/targets').then(function(res) {
            $scope.tags = res.data;
            groups = [...new Set($scope.tags.map(tags => tags.group))].filter(group => !!group)
        }, function(err) {
            $scope.state.error = err;
        })
    }
    load()

    $scope.edit = function(tag) {
        $uibModal.open({
            animation: true,
            ariaLabelledBy: 'modal-title',
            ariaDescribedBy: 'modal-body',
            templateUrl: './directives/tag-group-dialog.html',
            controller: function($scope, $uibModalInstance) {
                $scope.model = { tag, groups, selected: tag.group }
                $scope.ok = () => $uibModalInstance.close($scope.model)
                $scope.cancel = () => $uibModalInstance.dismiss('cancel')
            }
        }).result.then(function(model) {
            tag.group = model.new ? model.new : model.selected
            save(tag)
        }, (cancel) => {})
    }

    $scope.delete = function(item) {
        if(confirm("Delete " + item.name + "?")) {
            $http.delete(`./delete/tag/${item.type}/${item.name}`).then(load, error => {
                $scope.state.error = error.data
            })
        }
    }

    const save = (tag) => {
        $http.post('./save/tag', tag).then(function(res) {
            load()
        }, function(err) {
            $scope.state.error = err;
        })
    }
}