'use strict';

angular.module('MyKanban.view.alert_dialog', ['ui.bootstrap'])

.controller('AlertDialogInstanceCtrl', ['$scope', '$modalInstance', 'title', 'message', function ($scope, $modalInstance, title, message) {
  $scope.title = title;
  $scope.message = message;

  $scope.ok = function () {
    $modalInstance.close('ok');
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
}])

;
