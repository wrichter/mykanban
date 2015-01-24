'use strict';

/*
Backlog:

- time slider
- log entries for moves
- card moves
- prettier modal dialog

*/

angular.module('MyKanban.view.plain', ['ngRoute','ui.sortable', 'ui.bootstrap','MyKanban.view.card_modal', 'MyKanban.view.password_dialog'])

.config(['$routeProvider', '$httpProvider', function($routeProvider, $httpProvider) {
  $routeProvider.when('/board/:boardid', {
    templateUrl: 'view_board/view_board.html',
    controller: 'ViewController'
  });

//  $httpProvider.interceptors.push("intercept401");
}])
/*
.factory('intercept401', ['$rootScope','$q', '$location', function(scope, $q, $location) {
  return {
    response: function(response){
      if (response.status === 401) {
        console.log("Response 401");
      }
      return response || $q.when(response);
    },
    responseError: function(rejection) {
      if (rejection.status === 401) {
        console.log("Response Error 401",rejection);
        $location.path('/login').search('returnTo', $location.path());
      }
      return $q.reject(rejection);
    }
  }
}])*/

.controller('DropdownCtrl', function ($scope, $log) {
  $scope.items = [
  'The first choice!',
  'And another choice for you.',
  'but wait! A third!'
  ];

  $scope.status = {
    isopen: false
  };

  $scope.toggled = function(open) {
    $log.log('Dropdown is now: ', open);
  };

  $scope.toggleDropdown = function($event) {
    $event.preventDefault();
    $event.stopPropagation();
    $scope.status.isopen = !$scope.status.isopen;
  };
})


.controller('ViewController', ['$scope', '$routeParams', '$modal', '$http', 'listService', function($scope, $routeParams, $modal, $http, listService) {
  var baseURL = '/api/v1/board/' + $routeParams.boardid;

  $scope.board = {
      name: 'Sample Board',
      href: baseURL,
      lists: [
        { href: baseURL + '/list/126', name: "Ready", contents: listService.get(baseURL + '/list/122') },
        { href: baseURL + '/list/124', name: "Today", contents: listService.get(baseURL + '/list/123') },
        { href: baseURL + '/list/125', name: "Doing", contents: listService.get(baseURL + '/list/124') },
        { href: baseURL + '/list/123', name: "Done",  contents: listService.get(baseURL + '/list/125') }
      ]
  };


  $scope.cardSortableOptions = {
    connectWith: ".mk-list",
    cancel: ".panel-body",

/*
Single sortable demo

start
activate
 multiple: sort/change/over/out
beforeStop
update    <= call cancel() here if needed
deactivate
stop


Connected sortables demo

list A: start
list B: activate
list A: activate
both lists multiple: sort/change/over/out
list A: sort
list A: change
list B: change
list B: over
list A: sort
list B: out
list A: sort

list A: beforeStop
list A: update    <= call cancel() here if needed
list A: remove
list B: receive
list B: update
list B: deactivate
list A: deactivate
list A: stop*/


    //If the sortable item is being moved from one connected sortable to another:
    //$(ui.sender).sortable('cancel');
    //will cancel the change. Useful in the 'receive' callback.
    //$(ui.sender).sortable('cancel');
    receive: function(e, ui) {
    },

    update: function(e, ui) {
      /*var logEntry = tmpList.map(function(i){
        return i.value;
      }).join(', ');
      $scope.sortingLog.push('Update: ' + logEntry);*/
      //console.log(e);
      //console.log(ui);
      //console.log(ui.sender && ui.sender[0] == e.target);



      //if sort within list, ui.sender == null
      //if sort across list, the first update occurs for the sending list (ui.sender == ui.target)

    },
    stop: function(e, ui) {
      // this callback has the changed model
      /*var logEntry = tmpList.map(function(i){
        return i.value;
      }).join(', ');
      $scope.sortingLog.push('Stop: ' + logEntry);*/
    }
  };

  $scope.listSortableOptions = {
    connectWith: ".mk-listContainer",
    cancel: ".listName, .panel"
  }

  $scope.open_card = function (size, card) {
    var cardCopy = $.extend(true, card);

    var modalInstance = $modal.open({
      templateUrl: 'view_card_modal/view_card_modal.html',
      controller: 'ModalInstanceCtrl',
      size: size,
      backdrop: 'static',
      resolve: {
        card: function() { return card; }
      }
    });

    modalInstance.result.then(function() {
      console.log("card changed");
    });
  };

  $scope.new_card = function(size, list) {
    var card = {
      href:"",
      text:""
    };

    list.contents.push(card);
  };

  $scope.remove_card = function(list, card) {
    list.contents.splice(list.contents.indexOf(card),1);
    console.log('removed card: ' + card.href);
  }

  $scope.new_list = function() {
    $scope.board.lists.push({name: "New list", contents: [] });
  };


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

  $scope.link_dropped = function(card, href) {
    card.link = href;

    var http = $http.post(card.href + '/droplink', {
      href: href,
      card: card
    });

    http.success(function(data, status, headers, config) {
      console.log(data);
      // this callback will be called asynchronously
      // when the response is available
      /*if (data.response === 'NEEDS_AUTHENTICATION') {
        $scope.get_password(data, function() {

        });
      }*/

      card.text = data.text;
    }).
    error(function(data, status, headers, config) {
      // called asynchronously if an error occurs
      // or server returns response with an error status.
      console.log("error", data, status, headers, config);
    });
/*
    var iframe = $('<iframe style="display: hidden" src="' + href + '"></iframe');
    $("body").append(iframe);
    console.log("appended", iframe.get(0).contentWindow.document.title);
    iframe.on("load", function(ev) {
      console.log("loaded", iframe.get(0).contentWindow.document.title);
    });*/
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
  }

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

  $scope.current = true;
}])

.service('listService', [function(hr) {
  this.get = function(hr) {
    return [
      { href: hr + '/card/1', text: "11111", tags: ["abc", "5", "def"], weekday: "Monday", duration: 60 },
      { href: hr + '/card/2', text: "22222", weekday: "Tuesday", duration: 120 },
      { href: hr + '/card/3', text: "33333", weekday: "Tuesday", duration: 150 }
    ];
  }
}])


.directive("contenteditable", function() {
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
          newtext: ngModel.$viewValue,
        };
        if (data.oldtext != data.newtext) {
          element.trigger("mk-textchanged", data);
        }
      });
    }
  };
})

.directive("mkBlurOnEnter", function() {
  return {
    link: function(scope, element, attrs) {
      element.bind("keydown", function(e) {
        if (e.keyCode === 13) {
          element.blur();
        }
      });
    }
  };
})

.directive("listName", function() {
  return {
    restrict: "C",
    link: function(scope, element, attrs) {
      element.bind("mk-textchanged", function(ev, params) {
        console.log("changed list name from " + params.oldtext + " to " + params.newtext);
      });
    }
  };
})

.directive("panelBody", function() {
  return {
    restrict: "C",
    link: function(scope, element, attrs) {
      element.bind("mk-textchanged", function(ev, params) {
        console.log("changed card text from " + params.oldtext + " to " + params.newtext);
      });
    }
  };
})

.directive("mkLinkGrabber", function() {
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

        ta.on("dragleave", remove);
        ta.on("drop", function() {
          setTimeout(function() {
            scope.$apply(function() {
              //ngModel.$modelValue.link = ta.val();
              scope.link_dropped(ngModel.$modelValue, ta.val());

            });
            remove();
          }, 0);
        });
      });
    }
  };
})

.directive("mkCard", function() {
    return {
      restrict: "A",
      templateUrl: "view_board/card.html"
    }
})

;
