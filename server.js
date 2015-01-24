#!/bin/env node

var express 		= require('express');
//var fs      		= require('fs');
var mongodb 		= require('mongodb');
var path			= require('path');
var bodyParser 		= require('body-parser');
var ApiV1 			= require('./modules/APIV1');

var ServerApp = function(){

	// Scope
	var self = this;

	// Setup
	var mongoHost = process.env.OPENSHIFT_MONGODB_DB_HOST || 'localhost';
	var mongoPort = process.env.OPENSHIFT_MONGODB_DB_PORT || '27017';
	var mongoDB	  = process.env.OPENSHIFT_APP_NAME 		  || 'mykanban';
		
	self.dbServer = new mongodb.Server(mongoHost, parseInt(mongoPort));
	self.db = new mongodb.Db(mongoDB, self.dbServer, {auto_reconnect: true});
	self.dbUser = process.env.OPENSHIFT_MONGODB_DB_USERNAME;
	self.dbPass = process.env.OPENSHIFT_MONGODB_DB_PASSWORD;

	self.ipaddr  = process.env.OPENSHIFT_NODEJS_IP;
	self.port    = parseInt(process.env.OPENSHIFT_NODEJS_PORT) || 8080;

	if (typeof self.ipaddr === "undefined") {
		console.warn('No OPENSHIFT_NODEJS_IP environment variable');
	};

	// Logic to open a database connection. We are going to call this outside of
	// app so it is available to all our functions inside.
	self.connectDb = function(callback){
		self.db.open(function(err, db){
			if(err){ throw err };
			if (self.dbUser) { //if a mongo user is configured
				self.db.authenticate(self.dbUser, self.dbPass, {authdb: "admin"},  function(err, res){
					if(err){ throw err };
					callback();
				});
			} else {
				callback();
			}
		});
	};

	// starting the nodejs server with express
	self.startServer = function() {
		// Webapp urls
		self.app  = express();
		self.app.use(bodyParser.json());
		//self.app.use(express.methodOverride());
		//self.app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
		self.app.use(express.static(path.join(__dirname, 'static')));
		self.app.get('/health', function(req, res){ res.send('1'); });
		self.app.use('/api/v1/', (new ApiV1(self.db, '/api/v1/')).router);
		
		self.app.listen(self.port, self.ipaddr, function(){
			console.log('%s: Node server started on %s:%d ...', Date(Date.now()), self.ipaddr, self.port);
		});
	}

	// Destructors
	self.terminator = function(sig) {
		if (typeof sig === "string") {
			console.log('%s: Received %s - terminating Node server ...', Date(Date.now()), sig);
			process.exit(1);
		};
		console.log('%s: Node server stopped.', Date(Date.now()) );
	};

	process.on('exit', function() { self.terminator(); });
	['SIGHUP', 
	 'SIGINT', 
	 'SIGQUIT', 
	 'SIGILL', 
	 'SIGTRAP', 
	 'SIGABRT', 
	 'SIGBUS', 
	 'SIGFPE', 
	 'SIGUSR1', 
	 'SIGSEGV',
	 'SIGUSR2', 
	 'SIGPIPE', 
	 'SIGTERM'].forEach(function(element, index, array) {
		 process.on(element, function() { self.terminator(element); });
	});
};

//call the connectDb function and pass in the start server command
var serverApp = new ServerApp();
serverApp.connectDb(serverApp.startServer);
