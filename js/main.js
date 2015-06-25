var app = angular.module('LiveSwiper', ['LocalStorageModule']);
app.controller('customersCtrl', function ($scope, $sce, $http, $timeout, localStorageService) {
        $scope.userPreferences = {};
        var serviceConfiguration = {
            Twitch: {
                additionalParameters: '',
                getCustomUrl: function (response) {
                    return response.webEmbedURL_s.replace('hls', 'embed');
                }
            },
            Ustream: {
                additionalParameters: 'autoplay=true'
            },
            YouTube: {
                additionalParameters: 'autoplay=1&controls=1'
            },
            Dailymotion: {
                additionalParameters: 'autoplay=1'
            },
            Hitbox: {
                additionalParameters: ''
            },
            Bambuser: {
                additionalParameters: 'autoplay=1'
            },
            Azubu: {
                additionalParameters: ''
            }
        }
        $scope.changeTime = {
            num: 360
        };
        var PREFERENCE_STORAGE_KEY = 'LiveSwiperStorage';

        $scope.loadNextStream = function (userPreferences) {
            $http.get("http://api.liveguide.li/getRandomStream" + '?a=' + Math.floor((Math.random() * 1000) + 1) + buildFilter(userPreferences)) //Prevent caching with random parameter
                .success(function (response) {
                    response = response.response.content;
                    $scope.response = response;

                    if (response.hasOwnProperty('title')) {
                        $scope.title = response.title[0];
                    } else {
                        console.log('Stream response did not contain a title');
                        $scope.title = 'Unknown Stream';
                    }

                    if (response.hasOwnProperty('webEmbedURL_s')) {
                        $scope.embedURL = $sce.trustAsResourceUrl(buildStreamURL(response, serviceConfiguration));
                    } else {
                        handleIncorrectResponse('missing web webEmbedURL_s')
                    }

                    resetCounter();
                }).error(function (data, status, headers, config) {
                    handleIncorrectResponse(status);
                });
        }
        $scope.buildCustomPreference = function (field, value, preference) {
            console.log(preference);
            $scope.showModal = true;
            $scope.field = field;
            $scope.value = value;
            $scope.preference = preference;
        }
        $scope.addPreference = function (field, value, preference) {
            if (!$scope.userPreferences.hasOwnProperty(field)) {
                $scope.userPreferences[field] = {};
            }

            var thisField = $scope.userPreferences[field];

            if (!thisField.hasOwnProperty(preference)) {
                thisField[preference] = [];
            }

            if (thisField[preference].indexOf(value) === -1) {
                thisField[preference].push(value);
            }

            commitToStorage(PREFERENCE_STORAGE_KEY, $scope.userPreferences);

            console.log(field);
            console.log(value);
            console.log(preference);
            console.log($scope.userPreferences);
        }
        $scope.removePreference = function (field, index, preference) {
            var fullPreference = $scope.userPreferences[field];
            var currentPreference = $scope.userPreferences[field][preference];

            currentPreference.splice(index, 1);

            if (currentPreference.length === 0) {
                delete $scope.userPreferences[field][preference];
            }

            if (!fullPreference.hasOwnProperty('like') && !fullPreference.hasOwnProperty('dislike')) {
                delete $scope.userPreferences[field];
            }

            commitToStorage(PREFERENCE_STORAGE_KEY, $scope.userPreferences);
        }
        $scope.openSettings = function () {
            $scope.showSettings = true;
        }
        $scope.hideModal = function () {
            $scope.showModal = false;
        };
        $scope.removeType = function (field) {
            if (typeof field !== 'undefined') {
                return field.replace('_s', '').replace('_i', '');
            }
            return '';
        }
        $scope.secondsToHHMMSS = function (seconds, hasOperator) {
            var operator = '';

            if (hasOperator) {
                operator = seconds.charAt(0);
                seconds = seconds.replace(operator, '');
            }

            var sec_num = parseInt(seconds, 10); // don't forget the second param
            var hours = Math.floor(sec_num / 3600);
            var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
            var seconds = sec_num - (hours * 3600) - (minutes * 60);

            if (hours < 10) {
                hours = "0" + hours;
            }
            if (minutes < 10) {
                minutes = "0" + minutes;
            }
            if (seconds < 10) {
                seconds = "0" + seconds;
            }
            var time = hours + ':' + minutes + ':' + seconds;
            return operator + time;
        }
        $scope.HHMMSStoSeconds = function (HHMMSS) {
            //Do we have a regex match for HHMMSS format ?
            if (/([0-9]+):([0-5][0-9]):([0-5][0-9])/.test(HHMMSS)) {
                var time = HHMMSS.split(':');
                return (+time[0]) * 60 * 60 + (+time[1]) * 60 + (+time[2]);
            } else {
                return HHMMSS;
            }
        }

        var handleIncorrectResponse = function (message) {
            //TODO - add proper error message in UI
            console.log('There was a problem with current service json response: ' + message + ' . Loading next stream.');
            $scope.loadNextStream();
        }
        var buildFilter = function (userPreferences) {
            var filter = '';

            for (var field in userPreferences) {
                if (userPreferences.hasOwnProperty(field)) {
                    var newFilter;

                    if (getType(field) === 'string') {
                        newFilter = buildStringFilter($scope.removeType(field), userPreferences[field]);
                    }

                    if (getType(field) === 'int') {
                        newFilter = buildIntegerFilter($scope.removeType(field), userPreferences[field]);
                    }

                    if (newFilter !== '') {
                        filter = appendFilter(filter, newFilter);
                    }
                }
            }

            return filter === '' ? filter : "&filters=" + filter;
        }
        var buildStringFilter = function (fieldName, field) {
            var filter = '';

            if (field.hasOwnProperty('dislike')) {
                var dislikeArray = field.dislike;

                for (var i = 0; i < dislikeArray.length; i++) {
                    filter = appendFilter(filter, '-' + fieldName + '=' + dislikeArray[i]);
                }
            }

            if (field.hasOwnProperty('like')) {
                var likeArray = field.like;

                if (headsOrTails()) { //Should we pick from existing likes ?
                    var selection = likeArray[Math.floor(Math.random() * likeArray.length)];
                    filter = fieldName + '=' + selection;
                }
            }

            return filter;
        }
        var buildIntegerFilter = function (fieldName, field) {

            var greaterThan = [];
            var lesserThan = [];
            var equals = [];

            var filter = '';

            if (field.hasOwnProperty('dislike')) {
                var dislikeArray = field.dislike;
                for (var i = 0; i < dislikeArray.length; i++) {

                    if (dislikeArray[i].indexOf('=') !== -1) {
                        filter = appendFilter(filter, '-' + fieldName + '=' + dislikeArray[i].replace('=', ''));
                    }

                    if (dislikeArray[i].indexOf('<') !== -1) {
                        greaterThan.push(dislikeArray[i].replace('>', ''))
                    }

                    if (dislikeArray[i].indexOf('>') !== -1) {
                        lesserThan.push(dislikeArray[i].replace('<', ''))
                    }

                }

            }

            if (field.hasOwnProperty('like')) {
                var likeArray = field.like;

                for (var i = 0; i < likeArray.length; i++) {

                    if (likeArray[i].indexOf('=') !== -1) {
                        equals.push(likeArray[i].replace('=', ''));
                    }

                    if (likeArray[i].indexOf('<') !== -1) {
                        lesserThan.push(likeArray[i].replace('<', ''))
                    }

                    if (likeArray[i].indexOf('>') !== -1) {
                        greaterThan.push(likeArray[i].replace('>', ''))
                    }
                }
            }

            var selection = '*';
            if (headsOrTails()) { //Should we go for an exact integer ?
                if (equals.length !== 0) {
                    selection = equals[Math.floor(Math.random() * equals.length)];
                }
            } else {
                var floor = '*';
                var ceiling = '*';
                if (greaterThan.length !== 0) {
                    floor = Math.min.apply(Math, greaterThan) + 1; //Adding 1 to avoid >=
                }

                if (lesserThan.length !== 0) {
                    ceiling = Math.max.apply(Math, lesserThan) - 1; //Subtrackting 1 to avoid >=
                }

                selection = '[' + floor + ' TO ' + ceiling + ']';
            }

            filter = appendFilter(filter, fieldName + '=' + selection);
            return filter;
        }
        var appendFilter = function (current, newFilter) {
            var empty = current.length === 0;
            return current + (empty ? '' : ',') + newFilter;
        }
        var buildStreamURL = function (response, serviceConfiguration) {
            var service = response.service_s;
            var url = response.webEmbedURL_s;

            if (serviceConfiguration.hasOwnProperty(service)) {
                //$scope.service = response.service_s
                var serviceConfig = serviceConfiguration[service];

                if (serviceConfig.hasOwnProperty('getCustomUrl')) {
                    url = serviceConfig.getCustomUrl(response);
                }

                var join = url.indexOf('?') === -1 ? '?' : '&';
                return url + join + serviceConfig.additionalParameters;
            }

            return url;
        }
        var commitToStorage = function (key, model) {
            localStorageService.set(key, model);
        }
        var retrieveFromStorage = function (key) {
            return localStorageService.get(key);
        }
        var getType = function (field) {
            return field.indexOf('_s') !== -1 ? 'string' : 'int';
        }
        //50% chance to return true or false
        var headsOrTails = function () {
            return Math.floor(Math.random() * 2) == 0;
        }
        var resetCounter = function () {
            $scope.counter = $scope.changeTime.num;
        }
        var updateCounter = function () {
            if ($scope.counter === 0) {
                $scope.loadNextStream();
            } else {
                $scope.counter--;
            }
            $timeout(updateCounter, 1000);
        }
        var initializeApp = function () {
            if (localStorageService.keys().indexOf(PREFERENCE_STORAGE_KEY) !== -1) {
                $scope.userPreferences = retrieveFromStorage(PREFERENCE_STORAGE_KEY);
            }

            $timeout(updateCounter, 1000); //Start counter;
            $scope.loadNextStream($scope.userPreferences); //Load the first stream;
        }

        initializeApp();
    }
)

app.directive('errSrc', function () {
    return {
        link: function (scope, element, attrs) {
            element.bind('error', function () {
                if (attrs.src != attrs.errSrc) {
                    attrs.$set('src', attrs.errSrc);
                }
            });
        }
    }
});