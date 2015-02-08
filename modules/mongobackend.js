var mongoose = require('mongoose');

var Backend = function() {
	var self = this;
	
	var linkschema = new mongoose.Schema({
		href:		{ type: String },
		rel:		{ type: String },
		type:		{ type: String },
		title:		{ type: String }
	});
	self.Link = mongoose.model('link', linkschema);
	
	var attributeschema = new mongoose.Schema({
		name:		String,
		type:		String,
		value:		mongoose.Schema.Types.Mixed
	});
	self.Attribute = mongoose.model('attribute', attributeschema);
	
	var feedschema = new mongoose.Schema({
		instanceid:	{ type: mongoose.Schema.Types.ObjectId, default: mongoose.Types.ObjectId , required: true },
		updated:	{ type: Date, 'default': Date.now, required: true	},
		title:		{ type: String },
		tag:		[{ type: String }],
		link:		[{ type: self.Link }],
		attribute:	[{ type: self.Attribute }],
		entry:		[{ type: mongoose.Schema.Types.Mixed }] 
	});
	feedschema.index({instanceid: 1, updated: -1});
	
	var cardschema = new mongoose.Schema({
		instanceid:	{ type: mongoose.Schema.Types.ObjectId, 'default': mongoose.Types.ObjectId, required: true },
		updated:	{ type: Date, 'default': Date.now, required: true	},	
		title:		{ type: String },
		tag:		[{ type: String }],
		link:		[{ type: self.Link }],
		attribute:	[{ type: self.Attribute }],
		back:		{ type: String }
	});
	cardschema.index({instanceid: 1, updated: -1});
	
	var findInstance = function(instanceid, date, callback, fields) {
		var query = { 'instanceid': instanceid };
		if (date) query['updated'] = { $lte: date };
		
		return this.find( 
				/*query*/ query, 
				/*fields*/ 	(fields)?fields:null, 
				/*options*/ { limit: 1, sort: { 'updated': -1 } },
				/*callback*/ function(err, docs) {
					if (! callback) return;
					if (err) callback(err, undefined);
					else if (docs.length != 1) callback(undefined, null);
					else callback(undefined, docs[0]);
				});
	};
	feedschema.statics.findInstance = findInstance;
	cardschema.statics.findInstance = findInstance;
	
	var findInstances = function(instanceidarray, date, callback, fields) {
		//convert String to object ids
		var objids = [];
		instanceidarray.forEach(function(id) {objids.push( new mongoose.Types.ObjectId(id) )});
		
		var query = { instanceid: { $in: objids } };
		if (date) query['updated'] = { $lte: date };
		
		var groupOperator = {};
		var addGroupOperator = function(pathname) {
			groupOperator[pathname] = { $first : '$' + pathname }
		}
		if (fields) { fields.forEach(addGroupOperator); } 
		else { this.schema.eachPath(addGroupOperator); }
		groupOperator['_id'] = '$instanceid';
				
		this.aggregate( [{$match: query}, {$sort: {updated: 1}}, {$group: groupOperator }], function(err, res) {
			if (err) callback(err);
			else callback(undefined, res);
		});
	}
	feedschema.statics.findInstances = findInstances;
	cardschema.statics.findInstances = findInstances;
	
	
//	var instanceExists = function(instanceid, callback) {
//		this.find(
//				/*query*/	{ 'instanceid': instanceid }, 
//				/*fields*/ 	null, 
//				/*options*/ { limit: 1 }).count(function(err, num) { callback(err, num == 1); });	
//	}
//	feedschema.statics.instanceExists = instanceExists;
//	cardschema.statics.instanceExists = instanceExists;
	
	var containsEntry = function(feedinstanceid, entryinstanceid, at, callback) {
		this.findInstance(feedinstanceid, at, function(err, doc) {
			if (err) callback(err)
			else if (doc == null) callback(undefined, false);
			else callback(undefined, doc.entry.indexOf(entryinstanceid) >= 0);
		}, ['entry']);
	};
	feedschema.statics.containsEntry = containsEntry;
	
	var addEntryAndSetUpdatedToEntryUpdated = function(entry) {
		board._id = mongoose.Types.ObjectId(); //remove _id so it will create a new instance
		board.isNew = true;
		board.entry.push(entry.instanceid);
		board.markModified('entry');
		board.updated = entry.updated;
		return board;
	}
	feedschema.methods.addEntryAndSetUpdatedToEntryUpdated = addEntryAndSetUpdatedToEntryUpdated;
	
	//ensure that MixedType ObjectIds are stored as ObjectIds and not as String
	feedschema.pre('save', function(next) {
		if (this.entry) {
			for (var i=0; i<this.entry.length; i++) {
				if (/^[0-9a-f]{24}$/i.test(this.entry[i])) {
					this.entry[i] = new mongoose.Types.ObjectId(this.entry[i]);
				}
			}
		}
		next();
	})
	
	self.Board = mongoose.model('board', feedschema);
	self.List = mongoose.model('list', feedschema);
	self.Card = mongoose.model('card', cardschema);
	
	self.Board.schema.path('entry').validate(function(value) {
		var res = true;
		value.forEach(function(entry) {
			if (!(/^[0-9a-f]{24}$/i.test(entry)) && !(entry instanceof self.List)) res = false;
		});
		return res;
	}, 'Board entry type neither ObjectID nor List');
		
	self.List.schema.path('entry').validate(function(value) {
		var res = true;
		value.forEach(function(entry) {
			if (!(/^[0-9a-f]{24}$/i.test(entry)) && !(entry instanceof self.Card)) res = false;
		});
		return res;
	}, 'List entry type neither ObjectID nor Card');
	
	var hasDuplicateAttributes = function(value) {
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
	self.Card.schema.path('attribute').validate(hasDuplicateAttributes, 'Card has duplicate attributes');
	
	
	var aclschema = new mongoose.Schema({
		instanceid:	{ type: mongoose.Schema.Types.ObjectId,  required: true },
		updated:	{ type: Date, 'default': Date.now, required: true },
		read:		[String],
		write:		[String]
	});
	aclschema.statics.findInstance = findInstance;
	aclschema.statics.checkAccess = function(username, instanceid, at, callback) {
		this.findInstance(instanceid, at, function(err, acl) {
			if (err) callback (err); 
			else if (acl === null) callback(undefined, false, false, false);
			else {
				var read = (acl.read && acl.read.indexOf(username) >= 0);
				var write = (acl.write && acl.write.indexOf(username) >= 0);
				callback(undefined, true, read, write);
			}
		})
	};
	self.ACL = mongoose.model('acl', aclschema);
}

module.exports = new Backend();