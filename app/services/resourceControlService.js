angular.module('portainer.services')
.factory('ResourceControlService', ['$q', 'ResourceControl', 'RC', 'UserService', 'TeamService', 'ResourceControlHelper', function ResourceControlServiceFactory($q, ResourceControl, RC, UserService, TeamService, ResourceControlHelper) {
  'use strict';
  var service = {};

  service.createResourceControl = function(administratorsOnly, userIDs, teamIDs, resourceID, type) {
    var payload = {
      Type: type,
      AdministratorsOnly: administratorsOnly,
      ResourceID: resourceID,
      Users: userIDs,
      Teams: teamIDs
    };
    return RC.create({}, payload).$promise;
  };

  service.deleteResourceControl = function(rcID) {
    return RC.remove({id: rcID}).$promise;
  };

  service.updateResourceControl = function(admin, userIDs, teamIDs, resourceControlId) {
    var payload = {
      AdministratorsOnly: admin,
      Users: userIDs,
      Teams: teamIDs
    };
    return RC.update({id: resourceControlId}, payload).$promise;
  };

  service.applyResourceControl = function(resourceControlType, resourceIdentifier, userId, accessControlData) {
    if (!accessControlData.accessControlEnabled) {
      return;
    }

    var authorizedUserIds = [];
    var authorizedTeamIds = [];
    var administratorsOnly = false;
    switch (accessControlData.ownership) {
      case 'administrators':
        administratorsOnly = true;
        break;
      case 'private':
        authorizedUserIds.push(userId);
        break;
      case 'restricted':
        angular.forEach(accessControlData.authorizedUsers, function(user) {
          authorizedUserIds.push(user.Id);
        });
        angular.forEach(accessControlData.authorizedTeams, function(team) {
          authorizedTeamIds.push(team.Id);
        });
        break;
    }
    return service.createResourceControl(administratorsOnly, authorizedUserIds,
      authorizedTeamIds, resourceIdentifier, resourceControlType);
  };

  service.applyResourceControlChange = function(resourceControlType, resourceId, resourceControl, ownershipParameters) {
    if (resourceControl) {
      if (ownershipParameters.ownership === 'public') {
        return service.deleteResourceControl(resourceControl.Id);
      } else {
        return service.updateResourceControl(ownershipParameters.administratorsOnly, ownershipParameters.authorizedUserIds,
          ownershipParameters.authorizedTeamIds, resourceControl.Id);
      }
    } else {
        return service.createResourceControl(ownershipParameters.administratorsOnly, ownershipParameters.authorizedUserIds,
          ownershipParameters.authorizedTeamIds, resourceId, resourceControlType);
    }
  };

  service.retrieveOwnershipDetails = function(resourceControl) {
    var deferred = $q.defer();

    if (!resourceControl) {
      deferred.resolve({ authorizedUsers: [], authorizedTeams: [] });
      return deferred.promise;
    }

    $q.all({
      users: resourceControl.Users.length > 0 ? UserService.users(false) : null,
      teams: resourceControl.Teams.length > 0 ? TeamService.teams() : null
    })
    .then(function success(data) {
      var authorizedUserNames = [];
      var authorizedTeamNames = [];
      if (data.users) {
        authorizedUserNames = ResourceControlHelper.retrieveAuthorizedUsers(resourceControl, data.users);
      }
      if (data.teams) {
        authorizedTeamNames = ResourceControlHelper.retrieveAuthorizedTeams(resourceControl, data.teams);
      }
      deferred.resolve({ authorizedUsers: authorizedUserNames, authorizedTeams: authorizedTeamNames });
    })
    .catch(function error(err) {
      deferred.reject({ msg: 'Unable to retrieve user and team information', err: err });
    });

    return deferred.promise;
  };

  service.retrieveUserPermissionsOnResource = function(userID, isAdministrator, resourceControl) {
    var deferred = $q.defer();

    if (!resourceControl || isAdministrator) {
      deferred.resolve({ isPartOfRestrictedUsers: false, isLeaderOfAnyRestrictedTeams: false });
      return deferred.promise;
    }

    var found = _.includes(resourceControl.Users, userID);
    if (found) {
      deferred.resolve({ isPartOfRestrictedUsers: true, isLeaderOfAnyRestrictedTeams: false });
    } else {
      var isTeamLeader = false;
      UserService.userMemberships(userID)
      .then(function success(data) {
        var memberships = data;
        isTeamLeader = ResourceControlHelper.isLeaderOfAnyRestrictedTeams(memberships, resourceControl);
        deferred.resolve({ isPartOfRestrictedUsers: false, isLeaderOfAnyRestrictedTeams: isTeamLeader });
      })
      .catch(function error(err) {
        deferred.reject({ msg: 'Unable to retrieve user memberships', err: err });
      });
    }

    return deferred.promise;
  };

  // OLD

  service.setContainerResourceControl = function(userID, resourceID) {
    return ResourceControl.create({ userId: userID, resourceType: 'container' }, { ResourceID: resourceID }).$promise;
  };

  service.removeContainerResourceControl = function(userID, resourceID) {
    return ResourceControl.remove({ userId: userID, resourceId: resourceID, resourceType: 'container' }).$promise;
  };

  service.setServiceResourceControl = function(userID, resourceID) {
    return ResourceControl.create({ userId: userID, resourceType: 'service' }, { ResourceID: resourceID }).$promise;
  };

  service.removeServiceResourceControl = function(userID, resourceID) {
    return ResourceControl.remove({ userId: userID, resourceId: resourceID, resourceType: 'service' }).$promise;
  };

  return service;
}]);
