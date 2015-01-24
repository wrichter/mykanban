'use strict';

angular.module('MyKanban.view.card_modal', ['ui.bootstrap'])

.controller('ModalInstanceCtrl', ['$scope', '$modalInstance', 'card', function ($scope, $modalInstance, card) {
  $scope.card = card;
  $scope.tempCard = $.extend(true, card);

  $scope.ok = function () {
    $scope.card.href= $scope.tempCard.href;
    $scope.card.text= $scope.tempCard.text;

    $modalInstance.close('ok');
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
}])


;
