'use strict'

var promisify = require("promisify-node");
var gitty = require('gitty');
var Q = require("q");
var fse = promisify(require("fs-extra"));
var path = require("path");
var request = require('request');
var url = require('url');

module.exports = function() {
  var cred = {
    user:       undefined,
    password:   undefined,
    fullName:   undefined,
    email:      undefined,
    token:      undefined,
    type:       undefined,
    signature:  undefined
  }

  var repo = {
    url:          undefined,
    local:        undefined,
    owner:        undefined,
    name:         undefined,
    open:         undefined
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

    fse.readFile(directory, 'utf8')
    .done(function(data) {
      if(data) {
        var match = data.match(/url\s*=\s*[^\n]*/gm);

        repo.url = match[0].replace(/^url\s*=\s*/g,'');
        repo.owner = url.parse(repo.url).path.split('/')[1];
        repo.name = url.parse(repo.url).path.split('/')[2].split('.')[0];

        deferred.resolve();
      } else {
        deferred.reject();
      }
    });

    return deferred.promise;
  });

  var pub = {
    init: Q.async(function*(r, c, a) {

      if(r != undefined) {
        if(r.url) repo.url = r.url;
        if(r.owner) repo.owner = r.owner;
        if(r.name) repo.name = r.name;
        if(r.local) repo.local = r.local;
      }

      if(c != undefined) {
        if(c.user) cred.user = c.user;
        if(c.password) cred.password = c.password;
        if(c.fullName) cred.fullName = c.fullName;
        if(c.email) cred.email = c.email;
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

    createGithubRepo: Q.async(function*() {
      var deferred = Q.defer();

      request.post({
        headers: { 'User-Agent': 'nodegit-github', 'Authorization': 'token ' + cred.token, 'Content-type': 'application/json' },
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

      yield pub.clone();
      yield getRepoConfig(repo.local);

      yield request.post({
        headers: { 'User-Agent': 'nodegit-github', 'Authorization': 'token ' + cred.token, 'Content-type': 'application/json' },
        url: 'https://api.github.com/repos/' + repo.owner + '/' + repo.name + '/forks',
        organization: cred.user
      });

      repo.url = 'https://github.com/' + cred.user + '/' + repo.name + '.git';
      yield pub.setRemoteURL();

      deferred.resolve();

      return deferred.promise;
    }),

    clone: Q.async(function*() {
      var deferred = Q.defer();

      gitty.clone(repo.local, repo.url, function(err) {
        pub.open()
        .then(function() {
          deferred.resolve();
        })
      });

      return deferred.promise;
    }),

    status: Q.async(function*() {
      var deferred = Q.defer();

      repo.open.status(function(err, status) {
        console.log(status);
        deferred.resolve();
      });

      return deferred.promise;
    }),

    add: Q.async(function*() {
      var deferred = Q.defer();

      repo.open.add(['aaa2.rb'], function(err) {
        deferred.resolve();
      });

      return deferred.promise;
    }),

    commit: Q.async(function*() {
      var deferred = Q.defer();

      repo.open.commit('yeah yeah 2', function(err) {
        deferred.resolve();
      });

      return deferred.promise;
    }),

    push: Q.async(function*() {
      var deferred = Q.defer();

      repo.open.push('origin', 'master', { username: cred.user, password: cred.token }, function(err, result) {
        console.log(err);
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

    getConfig: Q.async(function*() {
      var deferred = Q.defer();

      gitty.getConfig('user', function(err, username) {
        deferred.resolve();
      });

      return deferred.promise;
    }),

    setRemoteURL: Q.async(function*() {
      var deferred = Q.defer();

      repo.open.setRemoteUrl('origin', repo.url, function(err) {
        deferred.resolve();
      });

      return deferred.promise;
    }),

    run: Q.async(function*(func) {
      if(repo.open == undefined && fse.existsSync(path.resolve(repo.local, '.git'))) {
        yield pub.open();
      }

      var result = yield pub[func]();
      return result;
    })
    
  }

  return pub;
}();
