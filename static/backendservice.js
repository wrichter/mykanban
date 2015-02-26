"use strict"; /*jshint -W097*/

var defaultPositionHintSpacing = 100;
var module = angular.module( "MyKanban.service.backend", [] );

module.factory( "BoardService",  [ "$http", "$q", function( $http, $q ) {
  function BoardService() {
    var self = this;

    self.getAllBoards = function() {
      return $http.get("/api/v1/boards");
    }

    self.create = function( board ) {
      return $http.post( "/api/v1/board", board );
    };

    self.retrieveDeep = function( boardid, at ) {
      var httpRequest, href = "/api/v1/board/" + boardid + "?deep=true";
      if ( at ) { href += "&at=" + at.toISOString(); }
      return $http.get( href );
    };

    self.update = function( board ) {
      return $http( getHTTPOperationForRel( board, "update", stripEntry ( board ) ) );
    };
  }
  return new BoardService();
} ] );

module.factory( "CardService", [ "$http", "$q", function( $http, $q ) {
  function CardService() {
    var self = this;

    self.create = function( list, card ) {
      card.positionHint = defaultPositionHintSpacing;
      if ( list.entry.length > 0 ) {
        card.positionHint +=  defaultPositionHintSpacing -
            ( list.entry[ list.entry.length - 1 ].positionHint % defaultPositionHintSpacing );
      };
      return $http( getHTTPOperationForRel( list, "add-card", card ) );
    };

    self.update = function( card ) {
      return $http( getHTTPOperationForRel( card, "update", card ) );
    };

    self.remove = function( card ) {
      return $http( getHTTPOperationForRel( card, "remove" ) );
    };

    self.addLink = function( card, href ) {
      return $http( getHTTPOperationForRel( card, "add-link", { href: href } ) );
    };

    self.updateCardPosition = function( board, newCardArray, changedCardIndex ) {
      var card, list,  collectionLink, oldHref;
      //find list for card array
      board.entry.forEach( function( l ) {
        if ( l.entry === newCardArray ) {
          list = l;
        }
      } );
      //ensure that card has proper collection link pointing to list
      if ( newCardArray.length == 1 ) {
        card = newCardArray[ 0 ]; //workaround - if target list was empty, index is reported as 1
      } else {
        card = newCardArray[ changedCardIndex ];
      }
      operateOnLinkOfRel( card, "collection", function( link ) {
        collectionLink = link;
        oldHref = link.href;
        link.href = list.href;
      } );

      //set PositionHint:
      return ensureProperPositionHints( $q, card, newCardArray, changedCardIndex, function( card ) {
        return self.update( card );
      } );
      //not trying to revert the changes if updates fail since the state is whack anyway
    };
  }
  return new CardService();
} ] );

module.factory( "ListService", [ "$http", "$q", function( $http, $q ) {
  function ListService() {
    var self = this;

    self.create = function( board, list ) {
      list.positionHint = defaultPositionHintSpacing;
      if ( board.entry.length > 0 ) {
        list.positionHint +=  defaultPositionHintSpacing -
        ( board.entry[ board.entry.length - 1 ].positionHint % defaultPositionHintSpacing );
      }
      return $http( getHTTPOperationForRel( board, "add-list", stripEntry( list ) ) );
    };

    self.update = function( list ) {
      return $http( getHTTPOperationForRel( list, "update", stripEntry( list ) ) );
    };

    self.remove = function( list ) {
      return $http( getHTTPOperationForRel( list, "remove" ) );
    };


    self.updateListPosition = function( board, newListArray, changedListIndex ) {
      var list;
      if ( newListArray.length == 1 ) {
        list = newListArray[ 0 ]; //workaround - if target list was empty, index is reported as 1
      } else {
        list = newListArray[ changedListIndex ];
      }
      return ensureProperPositionHints( $q, list, newListArray, changedListIndex, function( list ) {
        return self.update( list );
      } );
      //not trying to revert the changes if updates fail since the state is whack anyway
    };
  }
  return new ListService();
} ] );

function getHTTPOperationForRel( item, rel, data, params ) {
  var op = {};
  if ( data ) { op.data = data; }
  if ( params ) { op.params = params; }
  for ( var i = 0, link; link = item.link[ i++ ]; ) {
    if ( link.rel === rel ) {
      op.url = link.href;
      op.method = link.method;
      return op;
    }
  }
  return null;
}

function operateOnLinkOfRel( card, rel, func ) {
  for ( var i = 0, link; link = card.link[ i++ ]; ) {
    if ( link.rel === rel ) {
      func( link );
      return;
    }
  }
}

function ensureProperPositionHints( $q, item, newItemArray, changedIndex, update ) {
  var needReassignAllPositionHints = false,
  httpRequests = [],
  a, b, pos, promise;

  if ( newItemArray.length == 1 ) {
    // if it's the only item in the array
    //console.log("single item array")
    item.positionHint = defaultPositionHintSpacing;
  } else if ( changedIndex === newItemArray.length - 1 ) {
    //console.log("end")
    //  if added to the end: add some to last position hint
    item.positionHint = newItemArray[ changedIndex - 1 ].positionHint;
    item.positionHint += 2 * defaultPositionHintSpacing -
    ( item.positionHint % defaultPositionHintSpacing );
  } else if ( changedIndex === 0 ) {
    //  if added at the beginning: use half between 0 and second positionHint (*)
    //console.log("beginning");
    if ( newItemArray[ 1 ].positionHint < 2 ) {
      needReassignAllPositionHints = true;
    } else {
      item.positionHint = Math.floor( newItemArray[ 1 ].positionHint / 2 );
    }
  } else {
    //console.log("middle");
    //  if added in the middle: use half between a.PositionHint and b.PositionHint (*)
    a = newItemArray[ changedIndex - 1 ].positionHint;
    b = newItemArray[ changedIndex + 1 ].positionHint;

    if ( b - a < 2 ) {
      needReassignAllPositionHints = true;
    } else {
      item.positionHint = a + Math.floor( ( b - a ) / 2 );
    }
  }
  //console.log(item, needReassignAllPositionHints, changedIndex, newItemArray);
  if ( !needReassignAllPositionHints ) {
    // common case
    return update( item );
  } else {
    //  (*) if no suitable postion hint is found, reassign position hints for the whole list
    pos = defaultPositionHintSpacing;
    newItemArray.forEach( function( i ) {
      i.positionHint = pos;
      pos += defaultPositionHintSpacing;
      httpRequests.push( update( i ) );
    } );
    promise = $q.all( httpRequests );
    promise.success = function( func ) { return promise.then( function( resArray ) { func( resArray[ changedIndex ] ) } ); };
    promise.error = function( func ) { return promise.then( undefined, func ); };
    return promise;
  }
}

function stripEntry( item ) {
  var i = $.extend( true, {}, item );
  delete i.entry;
  return i;
}
