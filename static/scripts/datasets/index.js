import DatasetLoaderController from './DatasetLoaderController.js';
import DatasetImportController from './DatasetImportController.js'
import DatasetManageController from './DatasetManageController.js'

app.controller('DatasetLoaderController', DatasetLoaderController);
app.controller('DatasetImportController', DatasetImportController);
app.controller('DatasetManageController', DatasetManageController);

app.directive('datasetImportForm', function () {
    return {
        templateUrl: 'directives/dataset-import-form.html',
        scope: {
            dataset: '=',
            type: '<',
            autocomplete: '='
        },
        controller: 'FormController'
    };
});
