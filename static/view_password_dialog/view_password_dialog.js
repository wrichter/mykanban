'use strict';

angular.module('MyKanban.view.password_dialog', ['ui.bootstrap'])

.controller('PasswordDialogInstanceCtrl', ['$scope', '$modalInstance', 'auth', function ($scope, $modalInstance, auth) {
  $scope.auth = auth;

  $scope.ok = function () {
    $modalInstance.close('ok');
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
}])

;
