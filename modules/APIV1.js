var express = require('express');
var request = require('request');
var url 	= require('url');
var cheerio = require('cheerio');
var mongodb = require('mongodb');


module.exports = function(db, baseURL) {
	var self = this;
	self.router = express.Router();
	
	//create board
	self.router.post('/board', function(req, res) {
		var board = {
				'name': undefined,
				'lists': []
		};

		db.collection('board').insert(
				board, 
				{w: 1}, 
				function (err, doc) { 
					if (err) throw err;
					doc[0].href = baseURL + 'board/' + doc[0]._id;
					delete doc[0]._id;
					res.send(doc[0]);				
				});
	});
	
	//retrieve board
	self.router.get('/board/:boardid', function (req, res) {
		db.collection('board').findOne(
				{ _id: new mongodb.ObjectID(req.params.boardid) }, 
				function (err, item) {
					if (err) throw err;
					item.href = baseURL + 'board/' + item._id;
					delete item._id;
					res.send(item);
				});
	});
	
	//update board
	self.router.put('/board/:boardid', function (req, res) {
		var board = {};		
		if (req.body.name) board['name'] = req.body.name;
		if (req.body.name) board['lists'] = req.body.lists;

		db.collection('board').update(
				{ _id: new mongodb.ObjectID(req.params.boardid) },
				board, 
				{w:1},
				function(err, result) {
					if (err) throw err;
					res.status(204).send();
				});
	});

	self.router.post('/board/:boardid/list/:listid/card/:cardid/droplink', function(req, res) {
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
	});


}


