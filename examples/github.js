var koa = require('koa'),
    route = require('koa-route'),
    mount = require('koa-mount'),
    session = require('koa-session');

var Grant = require('grant-koa'),
    grant = new Grant(require('../auth.json'));

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

  yield git.run('clone');
  yield git.run('checkout');
  yield git.run('status');
  yield git.run('add');
  yield git.run('commit');
  yield git.run('push');
  */

  /*
  yield git.run('fork');
  yield git.run('getGithubUser');
  yield git.run('getGithubEmail');
  yield git.run('setRemoteURL');
  yield git.run('setCredentials');
  yield git.run('status');
  */

  
  yield git.run('status');
  yield git.run('add');
  yield git.run('commit');
  yield git.run('push');

  console.log('handled');

  this.body = JSON.stringify(this.query, null, 2);
}));

app.listen(3000, function() {
  console.log('Koa server listening on port ' + 3000);
});