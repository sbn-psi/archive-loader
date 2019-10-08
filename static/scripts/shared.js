const isEmptyObject = obj =>  {
    if (obj.constructor === Object) {
        for(var key in obj) {
            if(obj.hasOwnProperty(key) && !key.startsWith('$$') && !!obj[key]) {
                return false;
            }
        }
        return true;
    }
    return false;
}

app.constant('constants', {
    bundleType: 'Bundle',
    collectionType: 'Collection'
});

app.constant('sanitizer', function(formObject, templateModel) {
    if(!formObject) { return null }

    let sanitized = templateModel()
    for (const [key, value] of Object.entries(formObject)) {
        // put each field into the new sanitized object, unless it's inherited or angular-specific
        if (formObject.hasOwnProperty(key) && !key.startsWith('$$') && !!value) {
            if(value.constructor === Array) {
                // trim empty objects from the arrays
                let trimmed = value.filter(item => !isEmptyObject(item)) 
                sanitized[key] = trimmed;
            } else {
                // turn empty objects into nulls
                sanitized[key] = isEmptyObject(value) ? null : value;
            }
        }
    }

    // clean up tags, specifically
    if(!!sanitized.tags) { sanitized.tags = sanitized.tags.map(tag => tag.name)}

    return sanitized;
})

app.constant('prepForForm', function(model, templateFn) {
    if(!model) { return null }

    let template = templateFn()
    let prepped = Object.assign({}, model)

    Object.keys(template).forEach(key =>  {
        if(prepped[key] === undefined) {
            prepped[key] = template[key]
        }
    })

    // prep tags, specifically
    if(!!prepped.tags) { prepped.tags = prepped.tags.map(tag => { return {name: tag}})}

    return prepped;
})

app.service('lidCheck', function($http) {
    return function(lid) {
        return new Promise(function(resolve, reject) {
            if(!!lid && lid.constructor === String && lid.split(':').length > 3 && lid.startsWith('urn:nasa')) {
                $http.get('./lookup?lid=' + lid).then(function(res) {
                    resolve(res.data)
                }, function(err) {
                    reject(err)
                })
            } else {
                reject('Invalid lid')
            }
        })
    }
})

app.service('relatedLookup', function($http) {
    return function(from, to, lid) {
        return new Promise(function(resolve, reject) {
            if(!!lid && lid.constructor === String && lid.split(':').length > 3 && lid.startsWith('urn:nasa')) {
                $http.get(`./related/${to}?${from}=${lid}`).then(function(res) {
                    resolve(res.data)
                }, function(err) {
                    reject(err)
                })
            } else {
                reject('Invalid lid')
            }
        })
    }
})

app.constant('isPopulated', (val) => val && val.length > 0)

app.controller('FormController', function($scope) {
    $scope.progress = {}
    $scope.groupRepeater = function(array) {
        if(array.length === 0 || !isEmptyObject(array.last())) {
            array.push({})
        }
        return array.filter((val, index) => { return index === array.length-1 || !isEmptyObject(val)})
    }
})

app.controller('ContextObjectImportController', function($scope, $http, sanitizer, prepForForm, lidCheck, isPopulated, existing, tags, targetRelationships, instrumentRelationships) {
    $scope.tags = tags
    $scope.targetRelationships = targetRelationships
    $scope.instrumentRelationships = instrumentRelationships
    
    $scope.config = {}

    const validate = function() {
        return $scope.config.requiredFields.every(field => isPopulated($scope.model[$scope.config.modelName][field]))
    }

    const templateModel = function() {
        return {
            tags: [],
        }
    }

    $scope.submit = function() {
        if(validate()) {
            $scope.state.error = null;
            $scope.state.loading = true;  
            
            let postablePrimary = sanitizer($scope.model[$scope.config.modelName], templateModel)
            let primaryPost = $http.post($scope.config.primaryPostEndpoint, postablePrimary)

            let postableRelationships = []
            $scope.config.relationshipModelNames.forEach(relName => {
                postableRelationships = postableRelationships.concat($scope.model[relName].map(rel => $scope.config.relationshipTransformer(rel, relName)))
            })
            let relationshipsPost = $http.post('./relationships/add', postableRelationships)

            Promise.all([primaryPost, relationshipsPost]).then(function(res) {
                $scope.state.progress();
                $scope.state.loading = false;
            }, function(err) {
                $scope.state.error = err.data;
                $scope.state.loading = false;
                console.log(err);
            })
        } else {
            $scope.state.error = $scope.config.submitError;
        }
    }

    let configurated = false
    $scope.$watch('config.modelName', function(modelName) {
        if(!modelName || configurated === true) return
        configurated = true

        $scope.model = {
            [modelName]: existing ? prepForForm(existing, templateModel) : templateModel()
        }
        $scope.$watch(`model.${modelName}.logical_identifier`, function(lid) {
            if(!!existing) { return }
            $scope.state.loading = true;
            lidCheck(lid).then(function(doc) {
                $scope.state.loading = false;
                const replace = (scopeKey, docKey) => {
                    if(!isPopulated($scope.model[$scope.config.modelName][scopeKey])) { $scope.model[$scope.config.modelName][scopeKey] = doc[docKey][0] }
                }
                $scope.config.lookupReplacements.forEach(replacement => replace(replacement.formField, replacement.registryField))
            }, function(err) { 
                $scope.state.loading = false;
                // don't care about errors
            })
        })
    })
})

app.filter('pluralizeDumb', function() {
    return function(input) {
      return (angular.isString(input) && !input.endsWith('s')) ? `${input}s` : input;
    }
});