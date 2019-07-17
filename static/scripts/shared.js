app.constant('constants', {
    bundleType: 'Bundle',
    collectionType: 'Collection'
});

app.constant('sanitizer', function(formObject, templateModel) {
    const isEmptyObject = obj =>  {
        if (obj && obj.constructor === Object) {
            for(var key in obj) {
                if(obj.hasOwnProperty(key) && !key.startsWith('$$'))
                    return false;
            }
            return true;
        }
        return false;
    }
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
    return sanitized;
})


app.controller('FormController', function($scope) {
    $scope.groupRepeater = function(array) {
        if(array.length === 0 || !isEmptyObject(array.last())) {
            array.push({})
        }
        return array;
    }

    const isEmptyObject = obj =>  {
        if (obj.constructor === Object) {
            for(var key in obj) {
                if(obj.hasOwnProperty(key) && !key.startsWith('$$'))
                    return false;
            }
            return true;
        }
        return false;
    }
})