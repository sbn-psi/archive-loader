var app = angular.module('app', ['ui.bootstrap', 'ui.router', 'textAngular', 'ngFileUpload', 'ngCookies', 'ui.sortable']);

app.controller('RootController', function($scope, constants, $state, $transitions, loginState, logout, verifyLogin) {
    // set initial state
    $scope.constants = constants;
    $scope.state = {
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
        alerts: [],
        loggedIn: loginState.loggedIn,
        user: loginState.user()
    };

    $scope.logout = logout

    $scope.$on(loginState.broadcast, (event) => {
        $scope.state.loggedIn = loginState.loggedIn()
        $scope.state.user = loginState.user()
    })

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

    verifyLogin().then(() => {}, () => {})
});

app.service('loginState', function($cookies, $state, $rootScope) {
    const broadcast = 'loginState'
    let user = null
    return {
        broadcast,
        login: response => {
            user = response.user
            $rootScope.$broadcast(broadcast, user)
        },
        logout: () => {
            user = null
            $rootScope.$broadcast(broadcast, user)
            
            // remove browser session cookie
            $cookies.remove('archive-loader');

            $state.go('login')
        },
        loggedIn: () => !!user,
        user: () => user
    }
})

app.factory('logout', function($http, loginState) {
    return function() {
        $http.get('./logout').then(response => {
            loginState.logout()
        }, error => {
            // failed to logout via server... do it locally anyway
            loginState.logout()
            console.log(error)
        })
    }
})

app.factory('verifyLogin', function($http, $state, loginState) {
    return () => new Promise((resolve, reject) => {
        $http.get('./user').then(response => {
            loginState.login(response.data)
            resolve()
        }, err => {
            //not logged in, go to login
            $state.go('login')
            reject()
        })
    })
})

app.config(function($stateProvider) {
    $stateProvider.state({
        name: 'root',
        url: '',
        controller: function(verifyLogin, $state) {
            verifyLogin().then(() => {
                $state.go('datasets.manage')
            }, () => {})
        }
    })
    .state({
        name: 'login',
        url: '/login',
        data: {
            title: 'Login'
        },
        templateUrl: './states/login.html',
        controller: function($scope, loginState, $http, $state) {
            if(loginState.loggedIn()) {
                $state.go('root')
            }
            $scope.model = {}
            $scope.login = function() {
                $http.post('./login', $scope.model).then((response) => {
                    $scope.state.error = null
                    loginState.login(response.data)
                    $state.go('root')

                }, err => {
                    $scope.state.error = err.data
                })
            }
        }
    })
})

app.config(function($provide, $httpProvider) {
    $provide.factory('noAuthInterceptor', ($q, loginState) => {
        return {
            responseError: err => {
                if (err.status == 403) {
                    loginState.logout()
                    return $q.reject('Please log in');
                };

                // otherwise, just pass along the error
                return $q.reject(err)
            }
        };
    });

    $httpProvider.interceptors.push('noAuthInterceptor');
})

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