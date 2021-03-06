'use strict';

var promisify = require("promisify-node");
var gitty = require('gitty');
var Q = require("q");
var fse = require("fs-extra");
var path = require("path");
var request = require('request');
var url = require('url');

module.exports = function() {
  var cred = {
    user:       undefined,
    fullName:   undefined,
    email:      undefined,
    token:      undefined,
    type:       undefined,
    signature:  undefined
  }

  var repo = {
    url:          undefined,
    local:        undefined,
    copy:         undefined,
    owner:        undefined,
    name:         undefined,
    open:         undefined,
    files:        undefined
  };

  var tmp = {};
  var additional = {};
  var opts = { ignoreCertErrors: 1 };

  var getRepoConfig = Q.async(function*(thePath) {
    var deferred = Q.defer();

    var directory = undefined;
    if(fse.existsSync(path.resolve(thePath, 'config'))) {
      directory = path.resolve(thePath, 'config');
    } else {
      directory = path.resolve(thePath, '.git', 'config');
    } 

    fse.readFile(directory, 'utf8', function (err, data) {
      if(data) {
        var match = data.match(/url\s*=\s*[^\n]*/gm);

        repo.url = match[0].replace(/^url\s*=\s*/g,'');
        repo.owner = url.parse(repo.url).path.split('/')[1];
        repo.name = url.parse(repo.url).path.split('/')[2].split('.')[0];

        deferred.resolve();
      } else {
        deferred.reject();
      }
    })

    return deferred.promise;
  });

  var pub = {
    init: Q.async(function*(r, c, a) {

      if(r != undefined) {
        if(r.url) repo.url = r.url;
        if(r.copy) repo.copy = r.copy;
        if(r.owner) repo.owner = r.owner;
        if(r.name) repo.name = r.name;
        if(r.local) repo.local = r.local;
      }

      if(c != undefined) {
        if(c.token) cred.token = c.token;
        if(c.type) cred.type = c.type;
      }

      if(a != undefined) {
        for(var k in a) {
          additional[k] = a[k];
        }
      }

      return true;
    }),

    getGithubUser: Q.async(function*() {
      var deferred = Q.defer();

      request.get({
        headers: { 'User-Agent': 'gitty-github', 'Authorization': 'token ' + cred.token, 'Content-type': 'application/json' },
        url: 'https://api.github.com/user'
      }, function(err, httpResponse, body) {
        if(!err) {
          var u = JSON.parse(body);

          cred.user = u.login;

          if(u.name) {
            cred.fullName = u.name;
          } else {
            cred.fullName = u.login;
          }

          deferred.resolve();
        } else {
          deferred.reject();
        }
      });

      return deferred.promise;
    }),

    getGithubEmail: Q.async(function*() {
      var deferred = Q.defer();

      request.get({
        headers: { 'User-Agent': 'gitty-github', 'Authorization': 'token ' + cred.token, 'Content-type': 'application/json' },
        url: 'https://api.github.com/user/emails'
      }, function(err, httpResponse, body) {
        if(!err) {
          cred.email = JSON.parse(body)[0].email;
          
          deferred.resolve();
        } else {
          deferred.reject();
        }
      });

      return deferred.promise;
    }),

    createGithubRepo: Q.async(function*() {
      var deferred = Q.defer();

      request.post({
        headers: { 'User-Agent': 'gitty-github', 'Authorization': 'token ' + cred.token, 'Content-type': 'application/json' },
        url: 'https://api.github.com/user/repos',
        json: { name: repo.name }
      }, function(err, httpResponse, body) {
        if(!err) {
          deferred.resolve();
        } else {
          deferred.reject();
        }
      });

      return deferred.promise;
    }),

    fork: Q.async(function*() {
      var deferred = Q.defer();

      yield pub.getGithubUser();
      yield pub.getGithubEmail();

      yield pub.clone();
      yield getRepoConfig(repo.local);

      yield request.post({
        headers: { 'User-Agent': 'gitty-github', 'Authorization': 'token ' + cred.token, 'Content-type': 'application/json' },
        url: 'https://api.github.com/repos/' + repo.owner + '/' + repo.name + '/forks',
        organization: cred.user
      });

      repo.url = 'https://github.com/' + cred.user + '/' + repo.name + '.git';

      yield pub.setRemoteURL();
      yield pub.setCredentials();

      deferred.resolve();

      return deferred.promise;
    }),

    setCredentials: Q.async(function*() {
      var deferred = Q.defer();
      var promises = [];

      promises.push(gitty.setConfigLocal(repo.local, 'credential.helper', 'store --file ./.git-credentials', function(err) {
        deferred.resolve();
      }));

      promises.push(fse.writeFile(path.resolve(repo.local, '.git-credentials'), 'https://' + cred.user + ':' + cred.token + '@github.com' + '\n', function (err) {
        deferred.resolve();
      }));

      if(repo.open != undefined) {
        promises.push(gitty.setConfigLocal(repo.local, 'credential.https://github.com/' + cred.user + '/' + repo.name + '.git.username ', cred.user, function(err) {
          deferred.resolve();
        }));
      }

      return Q.all(promises);
    }),

    clone: Q.async(function*() {
      var deferred = Q.defer();

      fse.stat(repo.local, function(err, stats) {
        if(!stats.isDirectory()) {

          if(repo.copy != undefined) {
            fse.copy(repo.copy, repo.local, function (err) {
              if (err) return console.error(err);

              deferred.resolve();
            });
          } else {
            gitty.clone(repo.local, repo.url, function(err) {
              pub.open()
              .then(function() {
                deferred.resolve();
              })
            });
          }

        } else {
          deferred.resolve();
        }
      });

      return deferred.promise;
    }),

    status: Q.async(function*() {
      var deferred = Q.defer();

      repo.files = [];

      repo.open.status(function(err, status) {
        if(status.staged.length > 0) {
          status.staged.forEach(function(entry) {
            if(entry != '.git-credentials') repo.files.push(entry.file);
          });
        }

        if(status.unstaged.length > 0) {
          status.unstaged.forEach(function(entry) {
            if(entry != '.git-credentials') repo.files.push(entry.file);
          });
        }

        if(status.untracked.length > 0) {
          status.untracked.forEach(function(entry) {
            if(entry != '.git-credentials') repo.files.push(entry);
          });
        }

        deferred.resolve();
      });

      return deferred.promise;
    }),

    add: Q.async(function*() {
      var deferred = Q.defer();

      yield pub.status();
      
      repo.open.add(repo.files, function(err) {
        deferred.resolve();
      });

      return deferred.promise;
    }),

    commit: Q.async(function*() {
      var deferred = Q.defer();

      repo.open.commit('From FIC2 Playground', function(err) {
        deferred.resolve();
      });

      return deferred.promise;
    }),

    push: Q.async(function*() {
      var deferred = Q.defer();

      repo.open.push('origin', 'master', function(err, result) {
        if (err) return console.log(err);
        
        deferred.resolve();
      });

      return deferred.promise;
    }),

    open: Q.async(function*() {
      var deferred = Q.defer();

      try {
        repo.open = gitty(repo.local);

        deferred.resolve();
      } catch(e) {
        deferred.reject();
      }

      return deferred.promise;
    }),

    checkout: Q.async(function*() {
      var deferred = Q.defer();

      repo.open.checkout('master', function(err) {
        deferred.resolve();
      });

      return deferred.promise;
    }),

    setRemoteURL: Q.async(function*() {
      var deferred = Q.defer();

      repo.open.setRemoteUrl('origin', 'https://' + cred.user + ':' + cred.token + '@github.com/' + cred.user + '/' + repo.name + '.git', function(err) {
        deferred.resolve();
      });

      return deferred.promise;
    }),

    run: Q.async(function*(func) {
      if(repo.open == undefined && fse.existsSync(path.resolve(repo.local, '.git'))) {
        yield pub.open();
        yield getRepoConfig(repo.local);
      }

      var result = yield pub[func]();
      return result;
    })
    
  }

  return pub;
}();
