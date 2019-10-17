var app = angular.module('app', ['ui.bootstrap', 'ui.router', 'textAngular', 'ngFileUpload', 'ui.sortable']);

app.controller('RootController', function($scope, constants, $state, $transitions) {
    // set initial state
    $scope.constants = constants;
    $scope.state = {
        datasetType: constants.bundleType,
        progress: function() {
            switch($state.current.name) {
                case 'datasets.load': $state.go('datasets.import'); break;
                case 'datasets.import': $state.go('datasets.manage'); break;
                case 'datasets.manage': $state.go('datasets.import'); break;
                case 'targets.import': $state.go('targets.manage'); break;
                case 'targets.manage': $state.go('targets.import'); break;
                case 'missions.import': $state.go('missions.manage'); break;
                case 'missions.manage': $state.go('missions.import'); break;
                case 'spacecraft.import': $state.go('spacecraft.manage'); break;
                case 'spacecraft.manage': $state.go('spacecraft.import'); break;
                case 'instruments.import': $state.go('instruments.manage'); break;
                case 'instruments.manage': $state.go('instruments.import'); break;
            }
        },
        loading: false,
        transitioning: false,
        error: null,
        alerts: []
    };

    // handle transitions
    function beginTransitioning() {
        $scope.state.transitioning = true;
        $scope.state.loading = true;
    }
    function endTransitioning() {
        $scope.state.transitioning = false;
        $scope.state.loading = false;
    }
    $transitions.onStart({}, beginTransitioning)
    $transitions.onSuccess({}, endTransitioning)
    $transitions.onError({}, endTransitioning)

    // go to root state
    $state.go('root');
});

// provide custom image uploader
app.config(function($provide) {
    $provide.decorator('taOptions', ['taRegisterTool', 'taSelection', '$delegate', '$uibModal', function(taRegisterTool, taSelection, taOptions, $uibModal) { // $delegate is the taOptions we are decorating
        taRegisterTool('uploadImage', {
            iconclass: "fa fa-image",
            action: function() {
                var self = this
                $uibModal.open({
                    animation: true,
                    ariaLabelledBy: 'modal-title',
                    ariaDescribedBy: 'modal-body',
                    templateUrl: './directives/image-upload-dialog.html',
                    controller: function($scope, $uibModalInstance) {
                        $scope.model = {}
                        $scope.ok = () => $uibModalInstance.close($scope.model)
                        $scope.cancel = () => $uibModalInstance.dismiss('cancel')
                    }
                }).result.then(function(imageOptions) {
                    if(imageOptions && imageOptions.url) {
                        if (taSelection.getSelectionElement().tagName && taSelection.getSelectionElement().tagName.toLowerCase() === 'a') {
                            // due to differences in implementation between FireFox and Chrome, we must move the
                            // insertion point past the <a> element, otherwise FireFox inserts inside the <a>
                            // With this change, both FireFox and Chrome behave the same way!
                            taSelection.setSelectionAfterElement(taSelection.getSelectionElement());
                        }
                        var embed = `<img src="${imageOptions.url}"${imageOptions.width ? ' width="' + imageOptions.width + '"' : ''}${imageOptions.height ? ' height="' + imageOptions.height + '"' : ''}/>`
                        self.$editor().wrapSelection('insertHTML', embed, true);
                    }
                }, (cancel) => {})
            }
        });
        // replace the standard image button
        let toolbar = taOptions.toolbar[3]
        toolbar.splice(toolbar.indexOf('insertImage'), 1, 'uploadImage');
        return taOptions;
    }])
})