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

app.filter('pluralizeDumb', function() {
    return function(input) {
      return (angular.isString(input) && !input.endsWith('s')) ? `${input}s` : input;
    }
});