
app.directive('loading', function() {
    return {
        template: '<div class="lds-ring"><div></div><div></div><div></div><div></div></div>'
    }
});

app.directive('titleContainer', function() {
    return {
        template: '{{title}}',
        controller: function($scope, $transitions) {
            $transitions.onStart({}, function(trans) {
                let entering = trans.entering();
                if(!!entering[entering.length-1].data) {
                    $scope.title = entering[entering.length-1].data.title;
                } else {
                    $scope.title = 'Archive Loader';
                }
            })
        }
    }   
});

app.directive('imageUpload', function() {
    return {
        templateUrl: './directives/image-upload-widget.html',
        scope: {
            model: '=',
            error: '='
        },
        controller: function($scope, Upload) {
            
            $scope.upload = function (file, invalid, watcher) {
                if(!!invalid && invalid.length > 0) {
                    console.log(invalid)
                    watcher('Invalid file: Max size of 3MB')
                }
                if(!!file) {
                    Upload.upload({
                        url: './image/upload',
                        data: {file: file}
                    }).then(function (resp) {
                        watcher(null, null, resp.data.url)
                    }, function (resp) {
                        watcher(resp)
                    }, function (evt) {
                        var progressPercentage = parseInt(100.0 * evt.loaded / evt.total);
                        watcher(null, progressPercentage)
                    });
                }
            };

            $scope.uploadWatcher = function(error, progress, finalUrl) {
                if(!!error) {
                    $scope.error = error
                }
                if(!!progress) {
                    $scope.progress = progress
                }
                if(!!finalUrl) {
                    $scope.model = finalUrl
                }
            }
        }
    }   
});

app.directive('relationshipSelector', function() {
    return {
        templateUrl: './directives/relationship-selector.html',
        scope: {
            from: '@',
            to: '@',
            model: '=',
            lid: '<',
            relationshipTypes: '<'
        },
        controller: function($scope, relatedLookup) {
            if(!$scope.model) { $scope.model = []}

            $scope.$watch('lid', function(lid) {
                if(!!lid && lid.startsWith('urn:nasa')) {
                    relatedLookup($scope.from, $scope.to, lid).then(function(lids) {
                        mergeIntoModel(lids.map(related => { return { lid: related.identifier, name: related.title }}))
                    }, function(err) { 
                        console.log(err)
                        // don't care about errors
                    })
                }
            })

            function mergeIntoModel(toMerge) {
                toMerge.forEach(obj => { 
                    if(!$scope.model.some(orig => orig.lid === obj.lid)) {
                        $scope.model.push(obj)
                    } else {
                        $scope.model.find(rel => rel.lid === obj.lid).name = obj.name
                    }
                })
                $scope.$digest()
            }
            
        }
    }   
});