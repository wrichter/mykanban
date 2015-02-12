'use strict';

angular.module('MyKanban.view.card_modal', ['ui.bootstrap'])

.controller('ViewCardCtrl', ['$scope', '$modalInstance', 'card', function ($scope, $modalInstance, card ) {
  $scope.card = card;
  $scope.tempCard = $.extend(true, {}, card);

  $scope.ok = function() {
    ["back"].forEach( function( prop ) {
      $scope.card[ prop ] = $scope.tempCard[ prop ];
    } );
    $modalInstance.close( 'ok' );
  };

  $scope.cancel = function() {
    $modalInstance.dismiss( 'cancel' );
  };
}]);
