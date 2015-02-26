var mongoose = require('mongoose');

var Backend = function() {
	var self = this;

	var itemSchema = new mongoose.Schema({
		instanceid:		{ type: mongoose.Schema.Types.ObjectId, default: mongoose.Types.ObjectId, required: true },
		validFrom:		{ type: Date, 'default': Date.now, required: true },
		validTo:		{ type: Date },
		title:			{ type: String },
		tag:			[ { type: String } ],
		link:			[ {
			href:		{ type: String, required: true },
			rel:		{ type: String, required: true },
			type:		{ type: String },
			title:		{ type: String }
		}],
		attribute:		{},
		containedBy:	{ type: mongoose.Schema.Types.ObjectId },
		positionHint: 	{ type: Number, 'default': -1 },
		acl:			{ 								//for boards
			read:		[{ type: mongoose.Schema.Types.ObjectId }],
			write: 		[{ type: mongoose.Schema.Types.ObjectId }]
		},
		back:			{ type: String }				//for cards
	});

	var findInstancesContainedBy = function(instanceid, date, fields, additionalQueryParams, callback) {
		if (!callback) {
			callback = additionalQueryParams;
			additionalQueryParams = undefined;
		}

		var query;
		if (!date) date = Date.now();
		if (instanceid instanceof Array) {
			query = { containedBy: { $in: instanceid }, validFrom: { $lte: date}, $or: [{validTo: { $gt: date}}, {validTo: { $exists: false }}] }
		} else {
			query = { containedBy: instanceid, validFrom: { $lte: date}, $or: [{validTo: { $gt: date}}, {validTo: { $exists: false }}] };
		}
		if ( additionalQueryParams ) {
			for ( var prop in additionalQueryParams ) {
				if ( additionalQueryParams.hasOwnProperty( prop ) ) {
					query[ prop ] = additionalQueryParams[ prop ];
				}
			}
		}
		if ( !fields ) { fields = null; }
		this.find(query, fields, { sort: { positionHint: 1 } }, callback);
	}
	itemSchema.statics.findInstancesContainedBy = findInstancesContainedBy;

	var findInstance = function( instanceid, date, fields, callback ) {
		var query = { 'instanceid': instanceid };
		if (date) query['validFrom'] = { $lte: date };

		return this.find(
				query,
				(fields)?fields:null,
				{ limit: 1, sort: { 'validFrom': -1 } },
				function(err, docs) {
					if (! callback) return;
					if (err) callback(err, undefined);
					else if (docs.length != 1) callback(undefined, null);
					else callback(undefined, docs[0]);
				});
	};
	itemSchema.statics.findInstance = findInstance;

	var shallowClone = function( copyContainedBy ) {
		var data = {
			instanceid: this.instanceid,
			title: this.title,
			tag: this.tag,
			link: this.link,
			attribute: this.attribute,
			positionHint: this.positionHint
		}
		if ( copyContainedBy ) {
			data.containedBy = this.containedBy;
		}
		return new this.constructor(data);
	}
	itemSchema.methods.shallowClone = shallowClone;

	var updatePreviousDocumentOnSaveHook = function(next) {
		if (!this.validTo && this.validFrom) { // if validTo has not been set = this is the latest version
			//find previous version(s) (the one stored in the DB whose validTo field has not been set)
			//and set its validTo date to the validFrom date of the current document
			this.constructor.update(
					{ instanceid: this.instanceid, validTo: {$exists: false} },
					{ $set: {validTo: this.validFrom}},
					{ multi: true },
					function(err, numberAffected, raw) { next(err); }
					);
		}
	}
	itemSchema.pre('save', updatePreviousDocumentOnSaveHook);

	self.Board = mongoose.model('board', itemSchema);
	self.List = mongoose.model('list', itemSchema);
	self.Card = mongoose.model('card', itemSchema);

/*	var hasDuplicateAttributes = function(value) {
		if (!value) return true;
		var seen = {};
		value.forEach(function(attribute) {
			if (seen[attribute.name]) return false;
			seen[attribute.name] = true;
		})
		return true;
	}
	self.Board.schema.path('attribute').validate(hasDuplicateAttributes, 'Board has duplicate attributes');
	self.List.schema.path('attribute').validate(hasDuplicateAttributes, 'List has duplicate attributes');
	self.Card.schema.path('attribute').validate(hasDuplicateAttributes, 'Card has duplicate attributes');*/

	var userschema = {
		google: {
			id: String,
			emails: [String],
			token: String,
			refreshToken: String
		}
	}
	self.User = mongoose.model('user', userschema);
}

module.exports = new Backend();
