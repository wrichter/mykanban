module.exports = function( baseURL ) {
	var self = this;

	self.renderBoardArray = function( boards, at ) {
		var res = [];
		boards.forEach( function( board ) { res.push( self.renderBoard( board, at ) ); } );
		return res;
	};

	self.renderListArray = function( lists, at ) {
		var res = [];
		lists.forEach( function( list ) { res.push( self.renderList( list, at ) ); } );
		return res;
	};

	self.renderCardArray = function( cards, at ) {
		var res = [];
		cards.forEach( function( card ) { res.push( self.renderCard( card, at ) ); } );
		return res;
	};

	function renderGeneric( container, hrefAt, hrefContainerAt ) {
		var rendered = {
				href:		hrefAt,
				title:		container.title,
				validFrom:	container.validFrom,
				link:		[ ]
		};
		if (container.validTo) 	rendered.validTo = container.validTo;
		if (hrefContainerAt) 	{
			rendered.link.push( { rel: 'collection', method: 'GET', href: hrefContainerAt } );
		}
		rendered.tag = (container.tag)?container.tag:[];
	  rendered.attribute = (container.attribute)?container.attribute:{};
		if (container.positionHint) rendered.positionHint = container.positionHint;
		if (container.link) container.link.forEach(function(link) {
			rendered.link.push({
				rel: link.rel,
				href: link.href,
				method: 'GET',
				title: link.title,
				type: link.type
			});
		});
		return rendered;
	};

	function hrefAt(href, at) {
		return (at)?href+"?at="+at:href;
	};

	self.renderList = function(list, at) {
		var href = baseURL + '/list/' + list.instanceid;
		var hrefContainer = baseURL + '/board/' + list.containedBy;
		var rendered = renderGeneric(list, hrefAt(href,at), hrefAt(hrefContainer, at));
		if (list.entry) {
			rendered.entry = self.renderCardArray(list.entry, at);
		} else {
			rendered.entry = hrefAt(href + '/cards', at);
		}
		if (at) {
			rendered.link.push( { rel: 'current', method: 'GET', href: href } );
		} else {
			rendered.link.push( { rel: 'update', method: 'PUT', href: href } );
			rendered.link.push( { rel: 'add-card', method: 'POST', href: href + '/card' } );
			rendered.link.push( { rel: 'remove', method: 'POST', href: href + '/makeUnavailable' } );
		}
		return rendered;
	};

	self.renderBoard = function(board, at) {
		var href = baseURL + '/board/' + board.instanceid;
		var rendered = renderGeneric(board, hrefAt(href,at));
		if (board.entry) {
			rendered.entry = self.renderListArray(board.entry, at);
		} else {
			rendered.entry = hrefAt(href + '/lists', at);
		}
		if (at) {
			rendered.link.push( { rel: 'current', method: 'GET', href: href } );
		} else {
			rendered.link.push( { rel: 'update', method: 'PUT', href: href } );
			rendered.link.push( { rel: 'add-list', method: 'POST', href: href + '/list' } );
		}
		return rendered;
	};

	self.renderCard = function(card, at) {
		var href = baseURL + '/card/' + card.instanceid;
		var hrefContainer = baseURL + '/list/' + card.containedBy;
		var rendered = renderGeneric(card, hrefAt(href,at), hrefAt(hrefContainer, at));
		if (at) {
			rendered.link.push( { rel: 'current', method: 'GET', href: href } );
		} else {
			rendered.link.push( { rel: 'update', method: 'PUT', href: href } );
			rendered.link.push( { rel: 'add-link', method: 'POST', href: href + '/link' } );
			rendered.link.push( { rel: 'remove', method: 'POST', href: href + '/makeUnavailable' } );
		}
		rendered.back = card.back;
		return rendered;
	};

	self.parse = function(source, item) {
		item.title 				= source.title;
		if (source.back) item.back 	= source.back;
		item.tag					= source.tag;
		item.attribute 		= source.attribute;
		item.link					= [];
		if (source.link) source.link.forEach(function(link) {
			switch (link.rel) {
			case 'update':
			case 'add-link':
			case 'add-list':
			case 'add-card':
			case 'current':
			case 'remove':
				//ignore this link
				break;
			case 'collection':
				item.containedBy = /.*\/([A-Fa-f0-9]{24})(\?.*)?/.exec( link.href )[1];
				break;
			default:
				item.link.push(link);
				break;
			}
		});
		item.positionHint	= source.positionHint;
	};
};
