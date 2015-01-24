'use strict';

angular.module('MyKanban', ['ngRoute', 'MyKanban.view.plain'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.otherwise({redirectTo: '/'});
}]);
