"use strict"; /* jshint -W097 */

var module = angular.module( "MyKanban.view.board", [
                  "ngRoute",
                  "ui.sortable",
                  "ui.bootstrap",
                  "ui.bootstrap.datetimepicker",
                  "MyKanban.view.card_modal",
                  "MyKanban.view.password_dialog",
                  "MyKanban.view.alert_dialog",
                  "MyKanban.service.backend"
                ] );

module.config( [ "$routeProvider", function( $routeProvider ) {

  $routeProvider.when( "/board/:boardid/:at?", {
    templateUrl: "view_board_details/view_board_details.html",
    controller: "ViewController",
  } );

  /*$routeProvider.when("/board/:boardid/:at", {
    templateUrl: "view_board/view_board.html",
    controller: "ViewController"
  } );*/

} ] );

module.controller( "ViewController", [
                      '$scope',
                      '$location',
                      '$routeParams',
                      '$modal',
                      '$http',
                      'BoardService',
                      'ListService',
                      'CardService',
                       function( $scope, $location, $routeParams, $modal, $http, BoardService, ListService, CardService ) {

  $scope.boardid = $routeParams.boardid;
  $scope.board = null;
  $scope.at = ( $routeParams.at ) ? new Date($routeParams.at) : undefined;
  $scope.alerts = [];

  function loadBoard(at) {
    BoardService.retrieveDeep( $routeParams.boardid, ( at ) ? at : undefined )
                .success( function( board ) { $scope.board = board; } )
                .error( function( data, status, headers, config, statusText ) {
                    if ( status === 404 ) {
                      $scope.board = null;
                    } else {
                      alertHTTPError( data, status, headers, config, statusText );
                    }
                } );
  }

  $scope.navigateToVersionAt = function(date) {
alert(date);
    $location.path("/board/" + $scope.boardid + "/" + date.toISOString() );
  }

  $scope.navigateToCurrentVersion = function() {
    $location.path("/board/" + $scope.boardid);
  }

  //$watching will automatically ensure the functions are called during initialization
  $scope.$watch( "at", function( at ) {
    if ( at ) {
      $scope.navigateToVersionAt(at);
    }
  } );
  loadBoard( $scope.at );

  $scope.closeAlert = function( index ) {
    $scope.alerts.splice( index, 1 );
  };

  function alertHTTPError( data, status, headers, config, statusText ) {
    $scope.alerts.push( { type: "danger", msg: "HTTP Error " + status + ": " +
    statusText + "\nReload the Window to get the latest server state." } );
    console.log( data, status, headers, config, statusText );
  }

  $scope.cardSortableOptions = {
    connectWith: ".mk-list",
    cancel: ".panel-body",
    disabled: ($scope.at != null),
    stop: function( e, ui ) {
      var s = ui.item.sortable;
      //console.log("stop", s.index,  s.sourceModel, s.dropindex, s.droptargetModel, ui.sender);
      if ( s.droptargetModel ) {
        CardService.updateCardPosition( $scope.board, s.droptargetModel, s.dropindex )
            .error( alertHTTPError );
      }
    }
  };

  $scope.listSortableOptions = {
    connectWith: ".mk-listContainer",
    cancel: ".listName, .panel",
    disabled: ($scope.at != null),
    stop: function( e, ui ) {
      var s = ui.item.sortable;
      //console.log("stop", s.index,  s.sourceModel, s.dropindex, s.droptargetModel, ui.sender);
      if ( s.droptargetModel ) {
        ListService.updateListPosition( $scope.board, s.droptargetModel, s.dropindex )
        .error( alertHTTPError );
      }
    }
  };

  $scope.open_card = function (size, card) {
    var modalInstance = $modal.open({
      templateUrl: 'view_card_modal/view_card_modal.html',
      controller: 'ViewCardCtrl',
      size: size,
      resolve: {
        card: function() { return card; },
        readOnly: function () { return $scope.at != null; }
      }
    } ).result.then(function() {
      CardService.update( card )
          .error( alertHTTPError );
    });
  };

  $scope.newCard = function( list ) {
    CardService.create( list, { title: "" } )
        .success( function( card ) { list.entry.push( card ); } )
        .error( alertHTTPError );
  };

  $scope.cardTextChanged = function( card ) {
    CardService.update( card )
        .error( alertHTTPError );
  };

  $scope.removeCard = function( list, card ) {
    $modal.open({
      templateUrl: 'view_alert_dialog/view_alert_dialog.html',
      controller: 'AlertDialogInstanceCtrl',
      resolve: {
        title: function() { return "Delete Card"; },
        message: function() {
          return "Really delete the card titled '" + card.title + "'?";
        }
      }
    }).result.then(function() {
      CardService.remove( card )
      .success( function() { list.entry.splice( list.entry.indexOf( card ), 1 ); } )
      .error( alertHTTPError );
    });
  };

  $scope.newList = function( board ) {
    ListService.create( board, { title: "List" } )
        .success( function( list ) {
            list.entry = [];
            board.entry.push( list );
        } ).error( alertHTTPError );
  };

  $scope.removeList = function( board, list ) {
    $modal.open({
      templateUrl: 'view_alert_dialog/view_alert_dialog.html',
      controller: 'AlertDialogInstanceCtrl',
      resolve: {
        title: function() { return "Delete List"; },
        message: function() { return "Really delete the list titled '" + list.title + "'? " +
        "Note that all items contained in the list will also be unaccessible."; }
      }
    }).result.then(function() {
      ListService.remove( list )
        .success( function() { board.entry.splice( board.entry.indexOf( list ), 1 ); } )
        .error( alertHTTPError );
    });
  };

  $scope.listTextChanged = function( list ) {
    ListService.update( list )
        .error( alertHTTPError );
  };

  $scope.linkDroppedOnCard = function( card, href ) {
    CardService.addLink( card, href )
      .success( function( updatedCard ) {
        for ( var prop in updatedCard ) {
          if ( updatedCard.hasOwnProperty( prop ) ) {
            card[prop] = updatedCard[prop];
          }
        }
      } )
      .error( alertHTTPError );
  }

  $scope.relatedLinks = function( card ) {
    var relatedLinks = [];
    card.link.forEach( function( link ) {
      if ( link.rel === "related" ) {
        relatedLinks.push( link );
      }
    } );
    return relatedLinks;
  };

  $scope.visibleLists = function() {
    var res = [];
    if ( $scope.board ) {
      $scope.board.entry.forEach( function( list ) {
          if ( list.tag && list.tag.indexOf( "$TRASH" ) < 0 ) {
            res.push( list );
          }
      } );
    }
    return res;
  };

  $scope.getLinkOfRel = function( item, rel ) {
    var res = [];
    item.link.forEach( function( link ) {
        if ( link.rel === rel ) {
          res.push( link );
        }
    });
    if (res.length == 0) {
      return undefined;
    } else if (res.length == 1) {
      return res[0];
    } else {
      return res;
    }
  }

  // -------- TODO ------------

  $scope.get_password = function(auth, promise) {
    var modalInstance = $modal.open({
      templateUrl: 'view_password_dialog/view_password_dialog.html',
      controller: 'PasswordDialogInstanceCtrl',
      size: 'sm',
      backdrop: 'static',
      resolve: {
        auth: function() { return auth; }
      }
    });
    modalInstance.result.then(promise);
  }

  $scope.groupArrayOfObjects = function(list, board, func) {
    var arrayClone = list.contents.slice(0);

    var i = 0;
    arrayClone.forEach(function(element, index, array) { element.$_tempKey = i++; });
    arrayClone.sort(function(a,b) {
      if (a[property] < b[property]) { //TODO
        return -1;
      } else if (a[property] > b[property]) {
        return 1;
      } else {
        if (a.$_tempKey < b.$_tempKey) {
          return -1;
        } else if (a.$_tempKey > b.$_$tempKey ) {
          return 1;
        } else {
          return 0;
        }
      }
    });
    arrayClone.forEach(function(element, index, array) { delete element.$_tempKey; });

    var groups = [];
    var currentGroup = {};

    for (i=0; i<arrayClone.length; i++) {
      var propValue = (arrayClone[i][property]) ? arrayClone[i][property] : "undefined";
      if (!currentGroup.groupValue || currentGroup.groupValue != propValue) {
        currentGroup = {
          groupProperty: property,
          groupValue: propValue,
          contents: []
        }
        groups.push(currentGroup);
      }
      currentGroup.contents.push(arrayClone[i]);
    }
    return groups;
  };

  $scope.uiAggregates = {};
  $scope.uiAggregateAttributes = [
    {
      name: "Avg. Duration",
      func: function(valueStore, card, list, board) {
        if (valueStore.result == undefined) {
          valueStore.result = 0;
        }
        valueStore.result += card.duration / list.contents.length;
      }
    }, {
      name: "Total Duration",
      func: function(valueStore, card, list, board) {
        if (valueStore.result == undefined) {
          valueStore.result = 0;
        }
        valueStore.result += card.duration;
      }
    }
  ]
  $scope.uiSelectedAggregateAttribute = {};

  $scope.aggregate = function(board, list, attr) {
    $scope.uiSelectedAggregateAttribute[list.href] = attr;
    if (attr) {
      // für die Liste
      var valueStore = { result: undefined };
      list.contents.forEach(function(element, index, array) { attr.func(valueStore, element, list, board); });
      $scope.uiAggregates[list.href] = valueStore.result;

      if ($scope.uiGroups[list.href]) {
        $scope.uiGroups[list.href].forEach(function(e,i,a) {
          valueStore = { result: undefined };
          e.contents.forEach(function(element, index, array) { attr.func(valueStore, element, e, board); });
          e.uiAggregate = valueStore.result;
        });
      }
    } else {
      delete $scope.uiAggregates[list.href];
    }
  }

  $scope.uiGroups = {};
  $scope.uiGroupByAttributes = [
    {
      name: "Weekday",
      func: function(card, list, board) { return card.weekday }
    }, {
      name: "SomeOtherValue",
      func: function(card, list, board) { return undefined }
    }
  ];
  $scope.uiSelectedGroupByAttribute = {};
  $scope.groupBy = function(board, list, attr) {
    $scope.uiSelectedGroupByAttribute[list.href] = attr;
    if (attr) {
      var arrayClone = list.contents.slice(0);

      var i = 0;
      //add ascending temp key to remain sort order within group
      arrayClone.forEach(function(element, index, array) { element.$_tempKey = i++; });
      arrayClone.sort(function(a,b) {
        if (attr.func(a) < attr.func(b)) { //TODO
          return -1;
        } else if (attr.func(a) > attr.func(b)) {
          return 1;
        } else {
          if (a.$_tempKey < b.$_tempKey) {
            return -1;
          } else if (a.$_tempKey > b.$_$tempKey ) {
            return 1;
          } else {
            return 0;
          }
        }
      });
      //remove temp key
      arrayClone.forEach(function(element, index, array) { delete element.$_tempKey; });

      //add new group to result list whenever the property value changes
      $scope.uiGroups[list.href] = [];
      var currentGroup = {};
      for (i=0; i<arrayClone.length; i++) {
        var propValue = (attr.func(arrayClone[i])) ? attr.func(arrayClone[i]) : "undefined";
        if (!currentGroup.groupValue || currentGroup.groupValue != propValue) {
          currentGroup = {
            groupProperty: attr.name,
            groupValue: attr.func(arrayClone[i]),
            contents: [],
            uiAggregate: undefined
          }
          $scope.uiGroups[list.href].push(currentGroup);
        }
        currentGroup.contents.push(arrayClone[i]);
      }
      //recalculate aggregate
      $scope.aggregate(board, list, $scope.uiSelectedAggregateAttribute[list.href]);
    } else {
       delete $scope.uiGroups[list.href];
    }
  }
}]);


//DIRECTIVES

module.directive("contenteditable", function() {
  return {
    restrict: "A",
    require: "ngModel",
    link: function(scope, element, attrs, ngModel) {
      ngModel.$render = function() {
        element.html(ngModel.$viewValue || "");
      };

      element.on("focus", function() {
        element.data("mk-originaltext", ngModel.$modelValue)
      });

      element.bind("blur keyup change", function() {
        scope.$apply(function() {
          var html = element.html();
          if (html === "<br>") html="";
          ngModel.$setViewValue(html); });
      });

      element.on("blur", function() {
        var data = {
          oldtext: element.data("mk-originaltext"),
          newtext: ngModel.$viewValue
        };
        if (data.oldtext != data.newtext) {
          element.trigger("mk-textchanged", data);
        }
      });
    }
  };
});

module.directive("mkBlurOnEnter", function() {
  return {
    link: function(scope, element, attrs) {
      element.bind("keydown", function(e) {
        if (e.keyCode === 13) {
          element.blur();
        }
      });
    }
  };
});

module.directive("listName", function() {
  return {
    restrict: "C",
    scope: true,
    link: function(scope, element, attrs) {
      element.bind("mk-textchanged", function(ev, params) {
        //console.log("changed list name from " + params.oldtext + " to " + params.newtext);
        scope.listTextChanged(scope.list, params.newtext);
      });
    }
  };
});

module.directive("mkCard", function() {
  return {
    restrict: "A",
    scope: true,
    templateUrl: "view_board_details/card.html"
  };
});

module.directive("panelBody", function() {
  return {
    restrict: "C",
    scope: true,
    link: function(scope, element, attrs) {
      element.bind("mk-textchanged", function(ev, params) {
        //console.log("changed card text from " + params.oldtext + " to " + params.newtext);
        scope.cardTextChanged(scope.card, params.newtext);
      });
    }
  };
});

module.directive( "mkLinkGrabber", function() {
  return {
    restrict: "A",
    require: "ngModel",
    link: function(scope, element, attrs, ngModel) {
      element.on("dragenter", function(ev) {
        var ta = $('<textarea style="position: absolute; margin: 0; border: 0px; z-index: 99999999; opacity: 0.00000001" />');
        $("body").append(ta);
        ta.css(element.offset());
        ta.css(element.css(["height","width"]));
        element.addClass("mk-card-hover");

        var remove = function() {
           ta.remove();
           element.removeClass("mk-card-hover");
        }

        ta.on( "dragleave", remove );
        ta.on( "drop", function() {
          setTimeout( function() {
            scope.$apply( function() {
              //ngModel.$modelValue.link = ta.val();
              scope.linkDroppedOnCard(ngModel.$modelValue, ta.val());
            });
            remove();
          }, 0);
        });
      });
    }
  };
})
/*
module.directive( "mkUiSortable", ["$compile", function($compile) {
  return {
    restrict: "A",
    link: function(scope, element, attrs) {
      scope.$watch( scope.at, function( ) {
        if ( scope.at == null ) {
          element.attr( "ui-sortable", attrs.mkUiSortable );
        }
        element.removeAttr( "mk-ui-sortable" );
        $compile( element )( scope );
      } );
    }
  };
} ] ) */;
