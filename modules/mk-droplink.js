var express = require('express');
var request = require('request');
//var http = require('http');
//var https = require('https');
var url = require('url');
var cheerio = require('cheerio');
var router = express.Router();

router.post('/board/:boardid/list/:listid/card/:cardid/droplink', function(req, res) {
  var boardid = req.params[0];
  var listid = req.params[1];
  var cardid = req.params[2];


  //  fetch card from DB - workaround: get card from UI
  var card = req.body.card;


  request({
    url: req.body.href,
    headers: {
      'User-Agent': 'request',
      'Range': 'bytes=0-999'
    }
  }, function(error, response, body) {
    if (!error && (response.statusCode == 200 || response.statusCode == 206)) {
      switch (/([a-zA-Z\-/]*)/.exec(response.headers['content-type'])[0]) { // use regex to filter out additional info like "; encoding="UTF-8"
        case 'text/html':
        case 'application/xhtml+xml':
        case 'text/xml':
        case 'application/xml':
          var parsedHTML = cheerio.load(body);
          card.text += parsedHTML('title').text();
          //fall through
        default:
      }
      res.send(card);
    }
  });



  /*var getRequest = url.parse(req.body.href);
  getRequest.headers = {
    //'Authorization': 'Bearer 00D300000000bn6!ARUAQKNETJCxqF_K2UDRSFx6aoHVkcOJjuX4tEaJ39Ty67fvy0hUMVaOfPKsX0Jx7xxMbTlAocJlrkpvBA5A_3Wlsurf9Onb'
    'Range': 'bytes=0-999'
  };


  var callback = function(clientRes) {
    console.log('STATUS: ' + clientRes.statusCode);
    console.log('HEADERS: ' + JSON.stringify(clientRes.headers));
    clientRes.setEncoding('utf8');

    var body = '';
    clientRes.on('data', function (chunk) {
      console.log('BODY: ' + chunk);
      body += chunk;
    });
  };

  if (getRequest.protocol === 'https:') {
     https.request(getRequest, callback).end();
  } else if (getRequest.protocol === 'http:') {
    http.request(getRequest, callback).end();
  } else {
    res.sendStatus(500);
  }*/



  //TODO - analyze href
  /*var realm = href;

  if (! req.session.credentials) {
    req.session.credentials = {};
  }

  if (!req.session.credentials[realm]) {

  res.send({
    response: 'NEEDS_AUTHENTICATION',
    realm: href
  });

  */



});

router.get('/board/:boardid/list/:listid/card/:cardid/droplink', function(req, res) {
  var boardid = req.params[0];
  var listid = req.params[1];
  var cardid = req.params[2];

  //res.status(401).set('WWW-Authenticate','Basic realm="RealmName"').send('respond with a resource');
  res.send({
    response: 'NEEDS_AUTHENTICATION',
    realm: "salesforce.com"
  });

});

module.exports = router;
