'use strict';

var Q = require("q");
var github = require("../");

var fork = Q.async(function*() {
  console.log('fork');

  yield github.init(
    { url: 'https://github.com/pixelpark/ppnet.git', local: '/Development/git/gitty-github/tmp' },
    //{ local: '/Development/git/gitty-github/tmp/' },
    { user: 'USERNAME', type: 'token', token: 'GITHUB_TOKEN', fullName: 'FULLNAME', email: 'E-MAIL' }
  );

  /*
  Case 1

  yield github.run('clone');
  yield github.run('checkout');
  yield github.run('status');
  yield github.run('add');
  yield github.run('commit');
  yield github.run('push');
  */

  //Case 2
  //yield github.run('fork');
  //yield github.run('checkout');
  //yield github.run('status');
  //yield github.run('add');
  //yield github.run('commit');
  yield github.run('push');


  //Other
  //yield github.run('setRemoteURL');
  //yield github.run('getConfig');

  console.log('forked');
});

fork();