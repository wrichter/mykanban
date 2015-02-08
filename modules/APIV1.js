var express = require('express');
var request = require('request');
var url 	= require('url');
var cheerio = require('cheerio');
var backend = require('./mongobackend');


module.exports = function(baseURL) {
	var self = this;
	self.router = express.Router();
	
	var ensureAccess = function(req, res, checkRead, checkWrite, callback) {
		//using current ACLs and not historic ones, hence undefined for date
		backend.ACL.checkAccess(req.user.username, req.params.boardid, undefined, function(err, exists, read, write) {
			if (err) throw err;
			else if (!exists) res.status(404).send(); // if ACL does not exist, board doesn't exist either
			else if ((checkRead && !read) || (checkWrite && !write)) res.status(403).send();
			else callback();
		});
	};
	
	//create board - RFC5023 5.3
	self.router.post('/board', function(req,res)  {	
		var board = new backend.Board();
		parseFeed(req.body, board);
		
		board.save(function(err, board, numberAffected) {
			if (err) throw err;
			var acl = new backend.ACL({instanceid: board.instanceid, read: [req.user.username], write: [req.user.username]});
			acl.save(function(err) {
				if (err) throw err;
				res.status(200)
					.set('Location', objectIdToHref( [board.instanceid] ))
					.send(renderFeed(board));
			});
		});
	});
	
	//retrieve board - RFC5023 5.4.1
	self.router.get('/board/:boardid', function (req, res) {		
		ensureAccess(req, res, true, false, function() {
			 // if looking for board at a specific date, req.query.at will contain a date, undefined otherwise
			backend.Board.findInstance(req.params.boardid, req.query.at, function(err, board) {
				if (err) throw err;
				else if (board == null) res.status(404).send();
				else if (req.query.deep && req.query.deep === 'true') {
					backend.List.findInstances(board.entry, req.query.at, function(err, lists) { 
						if (err) throw err;
						//collapse all list entries (=cards) into a single array
						var cardids = [];
						lists.forEach(function(list) { cardids = cardids.concat(list.entry); });
						backend.Card.findInstances(cardids, req.query.at, function(err, cards) {
							if (err throw err);
							// TODO build datastructure from lists & cards
							res.status(200).send(renderFeed(board), [], req.query.at);
						});
					});
				} else {
					res.status(200).send(renderFeed(board), [], req.query.at);
				}
			});
		});
	});
	
	//update board - RFC5023 5.4.2
	self.router.put('/board/:boardid', function (req, res) {
		ensureAccess(req, res, false, true, function() {
			//ACL exists, so we can assume the board exists as well
			var board = new backend.Board({	//creates a new board with same instanceid but new updated timestamp
				'instanceid': req.params.boardid,
			});
			parseFeed(req.body, board);

			board.save(function(err, product, numberAffected) {
				if (err) throw err;
				else res.status(200).send();
			});
		});
	});
	
	//create list - RFC5023 5.3
	self.router.post('/board/:boardid/list', function(req, res) {
		ensureAccess(req, res, false, true, function() {
			var list = new backend.List();
			parseFeed(req.body, list);
			
			list.save(function(err, list, numberAffected) {
				if (err) throw err;
				backend.Board.findInstance(req.params.boardid, undefined, function(err, board) {
					if (err) throw err;
					board.addEntryAndSetUpdatedToEntryUpdated(list);
					board.save(function(err, board) {
						if (err) throw err;
						res.status(200)
							.set('Location', objectIdToHref( [list.instanceid] ))
							.send(renderFeed(list));
					});
				});
			});
		});
	});
	
	//retrieve list - RFC5023 5.4.1
	self.router.get('/board/:boardid/list/:listid', function (req, res) {		
		ensureAccess(req, res, true, false, function() {
			// continued access check - ensure that list is actually contained in board
			// if looking for list at a specific date, req.query.at will contain a date, undefined otherwise
			backend.Board.containsEntry(req.params.boardid, req.params.listid, req.param.at, function(err, contains) {
				if (err) throw err; 
				else if (contains) {
					backend.List.findInstance(req.params.listid, req.query.at, function(err, list) {
						if (err) throw err;
						else if (list == null) res.status(404).send();
						else res.status(200).send(renderFeed(list, [req.params.boardid], req.query.at));
					});
				} else {
					res.status(404).send();
				}
			});
		});
	});
	
	//update list - RFC5023 5.4.2
	self.router.put('/board/:boardid/list/:listid', function (req, res) {
		
		//TODO... ACLs....
		backend.Board.instanceExists(req.params.boardid, function(err, exists) {
			if (err) throw err;
			if (exists) {
				backend.List.instanceExists(req.params.listid, function(err, exists) {
					if (err) throw err;
					if (exists) {
						var list = new backend.List({	//creates a new board with same instanceid but new updated timestamp
							'instanceid': req.params.listid,
						});	
						parseFeed(req.body, list);
	
						list.save(function(err, product, numberAffected) {
							if (err) throw err;
							res.status(200).send();
						});					
						return;
					} 
				});	
			} 
			res.status(404).send();
		});
	});
	
	var objectIdToHref = function(ids, at) {
		var href = baseURL + 'board/' + ids[0];
		if (ids.length >= 2) {
			href += '/list/' + ids[1];
			if (ids.length >= 3) {
				href += '/card/' + ids[2];
			}
		}
		if (at) href += "?at=" + at;
		return href;
	}
	
	var hrefToObjectIds = function(href) {
		var regex = /.*\/board\/([a-f0-9]{24})(\/list\/([a-f0-9]{24})(\/card\/([a-f0-9]{24}))?)?$/;
		var tmp = regex.exec(href);
		var res = [];
		if (tmp[1]) res[0] = tmp[1];
		if (tmp[3]) res[1] = tmp[3];
		if (tmp[5]) res[3] = tmp[5];
		return res;
	}
	
	var renderCard = function(card, ids, at) {
		var href = objectIdToHref(ids.concat( [ card.instanceid ]), at);
		var target = {
			title:		card.title,
			back:		card.back,
			id:			href,
			updated: 	card.updated,
			tag: 		card.tag,
			attribute:	card.attribute,
			link: 		[ {'rel': 'self', 'href': href} ]
		}
		card.link.forEach(function(link) { 
			target.link.push(link);
		});
		return target;
	}
	
	var parseCard = function(source, card) {
		card.title 		= source.title;
		card.back 		= source.back;
		card.tag		= source.tag;
		card.attribute 	= source.attribute,
		card.link		= []
		if (source.link) source.link.forEach(function(link) {
			if (link.rel === 'self') {
				//ignore self link
			} else {
				card.link.push(link)
			}
		});
	}
	
	var renderFeed = function(feed, ids, at) {
		if (! ids) ids = [];
		var feedIDs = ids.concat( [ feed.instanceid ] );
		var href = objectIdToHref(feedIDs, at);
		
		var atom = {
			title: 		feed.title,
			id:			href,
			updated: 	feed.updated,
			category:	['list','card'][ids.length], // boards are feeds with entries of category 'list' and lists are feeds of category 'card'
			link:		[ {'rel': 'self', 'href': href} ],
			tag:		feed.tag,
			attribute:	feed.attribute,
			entry:		[]
		}

		feed.link.forEach(function(link) { 
			atom.link.push(link);
		});
		
		feed.entry.forEach(function(entry) {
			if (/^[0-9a-f]{24}$/i.test(entry)) {
				atom.entry.push({ 'src': objectIdToHref( feedIDs.concat([entry]) ) });
			} else if (ids.length == 0) { //(entry instanceof backend.List) {				
				var list = renderFeed(entry, feedIDs, at);
				atom.entry.push(list);
				/*	To avoid redundancy, deviate from Atom Syndication Format
				 * 
			     atom.entry.push({
					id:		list.id,
					title:	list.title,
					updated: list.updated,
					category: 'list',
					content: list
				});*/
			} else if (ids.length == 1) {//(entry instanceof backend.Card) {
				var card = renderCard(entry, feedIDs, at);
				atom.entry.push(card);
				/*atom.entry.push({
					id:		card.id,
					title:	card.title,
					updated: card.updated,
					category: 'card',
					content: card
				})*/
			} else {
				//TODO
				throw "not implemented";
			}
		});
		return atom;
	}
	
	
	
	var parseFeed = function(source, target) {
		target.title = source.title;
		target.category = source.category;
		target.link = [];
		target.tag = source.tag;
		target.attribute = source.attribute;
		target.entry = [];
		
		if (source.link) source.link.forEach(function(link) {
			if (link.rel === 'self') {
				//ignore self link
			} else {
				target.link.push(link)
			}
		});
		
		if (source.entry) source.entry.forEach(function(entry) {
			if (entry.hasOwnProperty('src')) { // if it's just a hyperlink
				var ids = hrefToObjectIds(entry.src);
				target.entry.push(ids[ids.length-1]);
			} else { // it is an embedded content
				if (target instanceof backend.Board) { // since the feed is a board, the entries must be lists
					//TODO
					throw "not implemented";
				} else if (target instanceof backend.List) { // since the feed is a list, the entries must be cards
					//TODO
					throw "not implemented";
				} else {
					//TODO
					throw "not implemented";
				}
			}
		});
	}
	

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
				switch (/([a-zA-Z\-/]*)/.exec(response.headers['content-type'])[0]) { // use regex to filter out additional info like '; encoding='UTF-8'
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