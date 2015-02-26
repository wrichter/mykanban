var express = require('express');
var request = require('request');
//var url 	= require('url');
var cheerio = require('cheerio');
var backend = require('./mongobackend');
var ParserRenderer = require('./parserrenderer');
var heuristics = require('./heuristics');


module.exports = function(baseURL) {
	var self = this;
	self.router = express.Router();
	self.pr 	= new ParserRenderer(baseURL);

	var loadBoardAndEnforceAccess = function(req, res, boardid, checkRead, checkWrite, callback) {
		if (!boardid) res.status(400).send('missing board id');
		else backend.Board.findInstance(boardid, undefined, undefined, function(err, board) { //use current ACL, not history one
			if (err) throw err;
			else if (!board) res.status(404).send('board ' + boardid + ' not found');
			else if (checkRead && (!board.acl.read || board.acl.read.indexOf(req.user._id) < 0)) res.status(403).send('no read access to board ' + boardid);
			else if (checkWrite && (!board.acl.write || board.acl.write.indexOf(req.user._id) < 0)) res.status(403).send('no write access to board ' + boardid);
			else if (!req.query.at) callback(board); //we already have loaded the right board
			//since at was provided, we need to load the board at the right time
			else backend.Board.findInstance(boardid, req.query.at, undefined, function(err, board) {
				if (err) throw err;
				else if (!board) res.status(404).send('board ' + boardid + ' not found');
				else callback(board);
			});
		});
	}

	var loadListAndEnforceAccess = function(req, res, listid, checkRead, checkWrite, callback) {
		if (!listid) res.status(400).send('missing list id');
		else backend.List.findInstance(listid, req.query.at, undefined, function(err, list) {
			if (err) throw err;
			else if (!list) res.status(404).send('list ' + listid + ' not found');
			else loadBoardAndEnforceAccess(req, res, list.containedBy, checkRead, checkWrite, function(board) { callback(board, list); });
		});
	}

	var loadCardAndEnforceAccess = function(req, res, cardid, checkRead, checkWrite, callback) {
		if (!cardid) res.status(400).send('missing card id');
		else backend.Card.findInstance(cardid, req.query.at, undefined, function(err, card) {
			if (err) throw err;
			else if (!card) res.status(404).send('card ' + card.containedBy + ' not found');
			else loadListAndEnforceAccess(req, res, card.containedBy, checkRead, checkWrite, function(board, list) { callback(board, list, card) });
		});
	}

	//create RFC5023 5.3
	self.router.post('/board', function(req,res) {
		var board  = new backend.Board();
		self.pr.parse(req.body, board);

		board.acl = { read: [req.user._id], write: [req.user._id] };
		board.save(function(err, board) {
			if (err) throw err;
			else {
				var rendered = self.pr.renderBoard(board);
				res.status(200).set('Location', rendered.href).send(rendered);
			}
		});
	});

	function createList( req, res, list ) {
		loadBoardAndEnforceAccess( req, res, list.containedBy, false, true, function( board ) {
			list.save( function( err, list ) {
				if ( err ) { throw err;
				} else {
					var rendered = self.pr.renderList( list );
					res.status( 200 ).set( 'Location', rendered.href ).send( rendered );
				}
			} );
		} );
	}

	self.router.post( '/list', function( req, res ) {
		var list  = new backend.List();
		self.pr.parse( req.body, list );
		createList( req, res, list );
	} );

	self.router.post( '/board/:boardid/list', function( req, res ) {
		var list  = new backend.List();
		self.pr.parse(req.body, list);
		list.containedBy = req.params.boardid;
		createList( req, res, list );
	} );

	function createCard( req, res, card ) {
		loadListAndEnforceAccess( req, res, card.containedBy, false, true, function( board, list ) {
			card.save( function( err, card ) {
				if ( err ) { throw err;
				} else {
					var rendered = self.pr.renderCard( card );
					res.status( 200 ).set( 'Location', rendered.href ).send( rendered );
				}
			} );
		} );
	}

	self.router.post('/card', function(req,res) {
		var card  = new backend.Card();
		self.pr.parse(req.body, card);
		createCard( req, res, card );
	});

	self.router.post( '/list/:listid/card', function( req, res ) {
		var card  = new backend.Card();
		self.pr.parse(req.body, card);
		card.containedBy = req.params.listid;
		createCard( req, res, card );
	} );

	//retrieve RFC5023 5.4.1
	self.router.get('/board/:boardid', function (req, res) {
		var deepQuery = (req.query.deep && req.query.deep === 'true');
		loadBoardAndEnforceAccess(req, res, req.params.boardid, true, false, function(board) {
			if (deepQuery) backend.List.findInstancesContainedBy(
					board.instanceid, req.query.at, undefined, function(err, lists) {
						if (err) throw err;
						board.entry = [];
						lists.forEach(function(list) {
							if (! list.tag || list.tag.indexOf("*TRASH") < 0) {
								board.entry.push(list.instanceid);
							}
						} );
						backend.Card.findInstancesContainedBy(board.entry, req.query.at, undefined, function(err, cards) {
							if (err) throw err;								//add lists to board
							//create hashmap mapping list id to array of cards
							var listToCards = {};
							//board.entry still contains a list of list ids from shallow query - use this to populate hashmap
							board.entry.forEach(function(listid) { listToCards[listid] = []; });
							//map card to list id
							cards.forEach(function(card) { listToCards[card.containedBy].push(card); });
							//assign deep list of lists to board
							board.entry = lists;
							board.entry.forEach(function(list) { list.entry = listToCards[list.instanceid]; });
							res.status(200).send(self.pr.renderBoard(board, req.query.at));
						});
					});
			else res.status(200).send(self.pr.renderBoard(board, req.query.at));
		});
	});

	self.router.get('/list/:listid', function (req, res) {
		var deepQuery = (req.query.deep && req.query.deep === 'true');
		loadListAndEnforceAccess(req, res, req.params.listid, true, false, function(board, list) {
			if (deepQuery) backend.Card.findInstancesContainedBy(req.params.listid, req.query.at, undefined, function(err, cards) {
					if (err) throw err;
					else {
						list.entry = cards;
						res.status(200).send(self.pr.renderList(list, req.query.at));
					}
				});
			else res.status(200).send(self.pr.renderList(list, req.query.at));
		});
	});

	self.router.get('/card/:cardid', function (req, res) {
		loadCardAndEnforceAccess(req, res, req.params.cardid, true, false, function(board, list, card) {
			res.status(200).send(self.pr.renderCard(card, req.query.at));
		});
	});

	//update RFC5023 5.4.2
	self.router.put('/board/:boardid', function (req, res) {
		loadBoardAndEnforceAccess(req, res, req.params.boardid, false, true, function(oldboard) {
			var newboard = new backend.Board({
				'instanceid': req.params.boardid
			});
			self.pr.parse(req.body, newboard);
			newboard.acl = oldboard.acl;	//carry over ACL
			newboard.save(function(err, board, numberAffected) {
				if (err) throw err;
				else res.status(200).send();
			});
		});
	});

	self.router.put('/list/:listid', function (req, res) {
		loadListAndEnforceAccess(req, res, req.params.listid, false, true, function(board, oldlist) {
			var newlist = new backend.List({
				'instanceid': req.params.listid
			});
			self.pr.parse(req.body, newlist);
			if (oldlist.containedBy.toHexString() != newlist.containedBy.toHexString()) res.status(400).send('list cannot be assigned to new board');
			else newlist.save(function(err, list, numberAffected) {
				if (err) throw err;
				else res.status(200).send();
			});
		});
	});

	self.router.put('/card/:cardid', function (req, res) {
		loadCardAndEnforceAccess(req, res, req.params.cardid, false, true, function(board, oldlist, oldcard) {
			var newCard = new backend.Card({
				'instanceid': req.params.cardid
			});
			self.pr.parse(req.body, newCard);

			backend.List.findInstance( newCard.containedBy, undefined, undefined, function( err, newList ) {
				if (err ) throw err;
				else if ( newList == null ) {
					res.status(400).send("listid " + newCard.containedBy + " not found");
				} else {
					//see what changed and invoke functions if necessary
					heuristics.applyCardHeuristics(board, oldlist, oldcard, newList, newCard);
					newCard.markModified('attribute');
					newCard.save(function(err, card, numberAffected) {
						if (err) throw err;
						else res.status(200).send( self.pr.renderCard( newCard, undefined) );
					});
				}
			});
		});
	});


	//get all lists for board - RC5023 5.2
	self.router.get('/board/:boardid/lists', function(req,res) {
		loadBoardAndEnforceAccess(req, res, req.params.boardid, true, false, function(board) {
			backend.List.findInstancesContainedBy(req.params.boardid, req.query.at, undefined, function(err, lists) {
				if (err) throw err;
				else send(res, self.pr.renderListArray(lists, req.query.at) )
			});
		});
	});

	//get all cards for list - RC5023 5.2
	self.router.get('/list/:listid/cards', function(req,res) {
		loadListAndEnforceAccess(req, res, req.params.listid, true, false, function(board, list) {
			backend.Card.findInstancesContainedBy(req.params.listid, req.query.at, undefined, function(err, cards) {
				if (err) throw err;
				else res.status(200).send(self.pr.renderCardArray(cards, req));
			});
		});
	});

	//get all boards - RC5023 5.2
	self.router.get('/boards', function(req,res) { //TODO validate ACL!
		backend.Board.find({ validTo: { $exists: false } },undefined,undefined, function(err, boards) {
//console.log(err, boards, req.user._id);
			if (err) throw err;
			else res.status(200).send(self.pr.renderBoardArray(boards));
		});
	});

	//Delete
	self.router.post( '/list/:listid/makeUnavailable', function( req, res ) {
		loadListAndEnforceAccess( req, res, req.params.listid,
															true, false, function( board, list ) {
			list = list.shallowClone(false);
			delete list.containedBy;	//TODO - move to "*TRASH" tagged board (?)
			list.save( function( err, list, numberAffected ) {
				if ( err ) { throw err;
				} else { res.status( 200 ).send(); }
			} );
		} );
	} );

	self.router.post( '/card/:cardid/makeUnavailable', function( req, res ) {
		loadCardAndEnforceAccess( req, res, req.params.cardid,
															true, false, function( board, list, card ) {
			card1 = card.shallowClone(false);

			//if the board contains a list tagged "*TRASH"
			//move it there instead of simply orphaning it
			backend.List.findInstancesContainedBy( board.instanceid, undefined, undefined,
																	{ tag: "*TRASH" }, function( err, lists ) {
				if ( err ) { throw err;
				} else {
					if ( lists.length > 0 ) { //if we've found a *TRASH list
						card1.containedBy = lists[0].instanceid;
					}
					card1.save( function( err, card, numberAffected ) {
						if ( err ) { throw err;
						} else { res.status( 200 ).send(); }
					} );
				}
			} );
		} );
	} );




	self.router.post('/card/:cardid/link', function(req, res) {
		loadCardAndEnforceAccess(req, res, req.params.cardid, false, true, function(board, list, card) {
			var newCard = card.shallowClone(true);
			var newLink = { href: req.body.href, rel: 'related' };

			//get link document title
			request({
				url: req.body.href,
				headers: {
					'User-Agent': 'request',
					'Range': 'bytes=0-999'
				}
			}, function(error, response, body) {
				//errors will be silently ignored
				if (!error && (response.statusCode == 200 || response.statusCode == 206)) {
					newLink.type = response.headers['content-type'];
					switch (/([a-zA-Z\+\-/]*)/.exec(newLink.type)[0]) { // use regex to filter out additional info like '; encoding='UTF-8'
					case 'text/html':
					case 'application/xhtml+xml':
					case 'text/xml':
					case 'application/xml':
						var parsedHTML = cheerio.load(body);
						var title = parsedHTML('title').text();
						newCard.title += " " + title;
						newLink.title = title;
						//fall through
					default:
					}
				}

				// apply other heuristics, such as recognizing YouTube Videos (create specifically typed links), Salesforce links (create oppty or customer links)
				heuristics.applyLinkHeuristics(req.body.href, newCard, newLink, response, body);

				if (!newCard.link) newCard.link = [];
				newCard.link.push(newLink);
//console.log(newCard);
				newCard.save(function(err, newCard) {
					if (err) throw err;
					res.status(200).send(self.pr.renderCard(newCard));
				});
			});
		});
	});
}
