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
                      "ListService",
                       function( $scope, $location, $routeParams, $modal, $http, BoardService, ListService ) {

  $scope.boards = null;
  $scope.alerts = [];

  function loadBoards() {
    BoardService.getAllBoards()
                .success( function( boards ) { $scope.boards = boards; } )
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
    //console.log("/board/" + href.substring(14))   ;
    $location.path("/board/" + href.substring(14));
  }


  $scope.createDefaultBoard = function() {
    // create board
    BoardService.create( { title: "New Board" } )
      .error( alertHTTPError )
      .success( function( board ) {
        return ListService.create(board, { title: "Backlog", containedBy: board.instanceid } )
          .error( alertHTTPError )
          .success( function() {
            return ListService.create(board, { title: "Ready", containedBy: board.instanceid } );
          } )
          .error( alertHTTPError )
          .success( function() {
            return ListService.create(board, { title: "Doing", containedBy: board.instanceid,
                    attribute: { "*TRACK": "TRACKDOING" } } );
          } )
          .error( alertHTTPError )
          .success( function() {
            return ListService.create(board, { title: "Done", containedBy: board.instanceid,
                    attribute: { "*TRACK": "TRACKDONE" } } );
          } )
          .error( alertHTTPError )
          .success( function() {
            return ListService.create(board, { title: "TRASH", containedBy: board.instanceid,
                    tag: [ "*TRASH" ] } )
          } )
          .error( alertHTTPError )
          .success( function() {
            $scope.navigateTo( board.href );
          } );
    } );
  };
} ] );
