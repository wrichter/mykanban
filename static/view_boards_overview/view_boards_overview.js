"use strict"; /* jshint -W097 */

var module = angular.module( "MyKanban.view.boards", [
                  "ngRoute",
                  "ui.sortable",
                  "ui.bootstrap",
                  "MyKanban.service.backend"
                ] );

module.config( [ "$routeProvider", function( $routeProvider ) {

  $routeProvider.when( "/boards", {
    templateUrl: "view_boards_overview/view_boards_overview.html",
    controller: "BoardsOverviewController"
  } );

} ] );

module.controller( "BoardsOverviewController", [
                      "$scope",
                      "$location",
                      "$routeParams",
                      "$modal",
                      "$http",
                      "BoardService",
                       function( $scope, $location, $routeParams, $modal, $http, BoardService ) {

  $scope.boards = null;
  $scope.alerts = [];

  function loadBoards() {
console.log("loadBoards");
    BoardService.getAllBoards()
                .success( function( boards ) { console.log("success", boards, $scope.boards); $scope.boards = boards; $scope.$apply(); } )
                .error( alertHTTPError );
  }
  loadBoards();

  $scope.closeAlert = function( index ) {
    $scope.alerts.splice( index, 1 );
  };

  function alertHTTPError( data, status, headers, config, statusText ) {
    $scope.alerts.push( { type: "danger", msg: "HTTP Error " + status + ": " +
    statusText + "\nReload the Window to get the latest server state." } );
    console.log( data, status, headers, config, statusText );
  }

  $scope.navigateTo = function(href) {
    console.log("/board/" + href.substring(14))   ;
    $location.path("/board/" + href.substring(14));
  }
} ] );
