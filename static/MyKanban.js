'use strict';

angular.module('MyKanban', ['ngRoute', 'MyKanban.view.board'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.otherwise({redirectTo: '/'});
}]);
