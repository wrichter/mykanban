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
      if ( s.droptargetModel ) {
        var card = ( s.droptargetModel.length == 1 ) ?
                      s.droptargetModel[ 0 ] :
                      s.droptargetModel[ s.dropindex ];
        CardService.updateCardPosition( $scope.board, s.droptargetModel, s.dropindex )
            .success( function( updatedCard ) { //TODO - was passiert im falle eines MAss Updates???
              for ( var prop in updatedCard ) {
                if ( updatedCard.hasOwnProperty( prop ) ) {
                  card[prop] = updatedCard[prop];
                }
              }
            } )
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
          if ( list.tag && list.tag.indexOf( "*TRASH" ) < 0 ) {
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

  // -------- TODO - leftover from the idea of the backend requesting additional credentials ------------

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


  //---- Aggregation of card values

  function totalDuration( valueStore, card, attributeName ) {
    if ( valueStore.total === undefined ) {
      valueStore.total = 0;
    }
    if ( valueStore.count === undefined ) {
      valueStore.count = 0;
    }
    if ( card.attribute[ attributeName ] && card.attribute[ attributeName ].duration ) {
      valueStore.total += card.attribute[ attributeName ].duration;
      valueStore.count++;
    }
  }

  function displayDuration( duration ) {
    var res = "", hours, minutes, seconds;

    seconds = Math.floor(duration / 1000);
    minutes = Math.floor(seconds / 60);
    hours = Math.floor(minutes / 60);

    minutes -= hours * 60;
    seconds -= minutes * 60;

    if ( hours > 0) {
      res += hours + "h ";
    }
    if (minutes > 0) {
      res += minutes + "m ";
    }
    res += seconds + "s ";
    return res;
  }

  $scope.aggregatesAvailable = [
    {
      name: "Average Doing duration",
      aggregate: function( valueStore, card ) { totalDuration( valueStore, card, "TRACKDOING" ); },
      evaluate:  function( valueStore ) { return valueStore.total / valueStore.count; },
      display: displayDuration
    },
    {
      name: "Total Doing duration",
      aggregate: function( valueStore, card ) { totalDuration( valueStore, card, "TRACKDOING" ); },
      evaluate:  function( valueStore ) { return valueStore.total; },
      display: displayDuration
    }
  ];

  $scope.aggregate = function( list, agg ) {
    if ( !agg ) return undefined;
    var valueStore = { total: 0, count: 0 };
    list.entry.forEach( function( card ) { agg.aggregate( valueStore, card ); } );
    return agg.evaluate(valueStore);
  }

  //---- Grouping of card values

  $scope.groupingsAvailable = [
    {
      name: "Weekday done",
      func: function( card ) {
        if ( !card.attribute || !card.attribute["TRACKDONE"] || !card.attribute["TRACKDONE"].entry ) {
          return undefined;
        }
        var entry = card.attribute["TRACKDONE"].entry;
        if ( typeof entry === "string" ) {
          entry = new Date(entry);
        }
        return entry.getDay();
      },
      display: function ( day ) {
        if (!day) {
          return undefined;
        } else {
          return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day];
        }
      }
    }
  ];
  $scope.groupBy = function( list, grouping ) {
    if ( ! grouping ) {
      return list;
    }

    var arrayClone = list.entry.slice(0);
    var i = 0;

    //add ascending temp key to remain sort order within group
    var originalIndex = {};
    arrayClone.forEach(function(element, index, array) { originalIndex[element.href] = i++; });
    arrayClone.sort(function(a,b) {
      if (grouping.func(a) < grouping.func(b)) {
        return -1;
      } else if (grouping.func(a) > grouping.func(b)) {
        return 1;
      } else {
        if (originalIndex[a.href] < originalIndex[b.href]) {
          return -1;
        } else if ( originalIndex[a.href] > originalIndex[b.href] ) {
          return 1;
        } else {
          return 0;
        }
      }
    });

    //add new group to result list whenever the property value changes
    var result = [];
    var currentGroup;
    for (i=0; i<arrayClone.length; i++) {
      var propValue = grouping.func(arrayClone[i]);
      if (!currentGroup || currentGroup.groupValue != propValue) {
        currentGroup = {
          groupProperty: grouping.name,
          groupValue: propValue,
          entry: [],
          aggregate: undefined
        }
        result.push(currentGroup);
      }
      currentGroup.entry.push(arrayClone[i]);
    }
    return result;
  }

  $scope.setGroupBy = function(list, grouping) {
    if ( grouping ) {
      list.$groups = $scope.groupBy( list, grouping );
      list.$groupBy = grouping;
    } else {
      delete list.$groups;
      delete list.$groupBy;
    }
  }

  $scope.getGroupBy = function(list) {
    return list.$groupBy;
  }

  $scope.getGroups = function( list ) {
    return list.$groups;
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
