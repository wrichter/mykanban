'use strict'; /* jshint -W097 */

angular.module('MyKanban', ['ngRoute', 'MyKanban.view.boards', 'MyKanban.view.board'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.otherwise({redirectTo: '/boards'});
}]);
