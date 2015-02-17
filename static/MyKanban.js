'use strict'; /* jshint -W097 */

angular.module('MyKanban', ['ngRoute', 'MyKanban.view.boards', 'MyKanban.view.board'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when( "/login", {
    templateUrl: "login.html"
  } );


  $routeProvider.otherwise({redirectTo: '/login'});
}]);
