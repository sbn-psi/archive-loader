
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

app.directive('manageList', function() {
    return {
        scope: {
            edit: '<',
            list: '<',
            groupBy: '@?'
        },
        templateUrl: './directives/manage-list.html',
        controller: function($scope, lidCheck) {
            $scope.view = {}
            $scope.$watch('list', list => {
                let groups = []
                let ungrouped = []
                if(!!$scope.groupBy && !!list) {
                    list.forEach(item => {
                        let groupLid = item[$scope.groupBy]
                        if(!!groupLid) {
                            if(!groups.some(group => group.lid == groupLid)) {
                                groups.push({lid:groupLid})
                            }
                        } else {
                            ungrouped.push(item)
                        }
                    })
                } else {
                    // if not grouping, just throw everything into one group
                    groups = [{}]
                }
                $scope.groups = groups.sort((a, b) => (a.lid > b.lid) ? 1 : -1)
                $scope.ungrouped = ungrouped
            })

            $scope.$watch('groups', groups => {
                let groupsWithLids = groups.filter(group => !!group.lid)
                let lookups = groupsWithLids.map(group => lidCheck(group.lid))
                Promise.all(lookups).then(results => {
                    results.forEach((result, index) => {
                        groupsWithLids[index].name = result.title
                    })
                    $scope.$digest();
                })
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
                    relatedLookup($scope.from, $scope.to, lid).then(mergeIntoModel, function(err) { 
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
                        let existing = $scope.model.find(rel => rel.lid === obj.lid)
                        existing.name = obj.name
                        existing.relationshipId = obj.relationshipId
                    }
                })
                $scope.$digest()
            }
            
        }
    }   
});

app.directive('relatedToolSelector', function() {
    return {
        templateUrl: './directives/related-tool-selector.html',
        scope: {
            tools: '<',
            selected: '=model'
        },
        controller: function($scope) {
            if(!$scope.selected) { $scope.selected = []}

            $scope.toolClicked = function(tool) {
                if($scope.selected.includes(tool.toolId)) { $scope.selected.splice($scope.selected.indexOf(tool.toolId), 1); }
                else { $scope.selected.push(tool.toolId); }
            }
            
        }
    }   
});