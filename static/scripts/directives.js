
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