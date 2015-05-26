angular.module('LiveSwiper')
    .directive('streamInfo', function () {
        return {
            restrict: 'E',
            scope: {
                streamInfo: '=info',
                addPreference: '&addPref'
            },
            templateUrl: 'streamInfo/streamInfoTemplate.html'
        };
    });