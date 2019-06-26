import TargetImportController from './TargetImportController.js';
import TargetsManageController from './TargetsManageController.js';

app.controller('TargetImportController', TargetImportController);
app.controller('TargetsManageController', TargetsManageController);

app.directive('targetImportForm', function () {
    return {
        templateUrl: 'directives/target-import-form.html',
        scope: {
            target: '=',
        },
        controller: 'FormController'
    };
});