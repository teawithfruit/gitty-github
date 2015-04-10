var koa = require('koa'),
    route = require('koa-route'),
    mount = require('koa-mount'),
    session = require('koa-session');

var Grant = require('grant-koa'),
    grant = new Grant(require('../config.json'));

var Q = require("q");
var git = require("../");

var app = koa();
app.keys = ['whatever'];
app.use(session(app));
app.use(mount(grant));

app.use(route.get('/handle/github', function* (next) {
  console.log('handle');

  yield git.init(
    { url: 'https://github.com/pixelpark/ppnet.git', local: '/Development/git/gitty-github/tmp' },
    { type: 'token', token: this.query['raw[access_token]'] }
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
  yield git.run('getGithubUser');
  yield git.run('getGithubEmail');
  yield git.run('setCredentials');
  //yield github.run('push');


  //Other
  //yield github.run('setRemoteURL');
  //yield github.run('getConfig');

  console.log('handled');

  this.body = JSON.stringify(this.query, null, 2);
}));



app.listen(3000, function() {
  console.log('Koa server listening on port ' + 3000);
});