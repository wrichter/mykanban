var GoogleStrategy  = require( "passport-google-oauth" ).OAuth2Strategy;
var passport        = require( "passport" );
var backend         = require( "../api/v1/mongobackend" );


module.exports = function( app, successRedirect, failureRedirect ) {
  var CLIENTID = process.env.GOOGLE_AUTH_CLIENTID || "585754478444-7a4sbljvjvu3pkn6o8ltvqjtti0ccfq6.apps.googleusercontent.com";
  var CLIENTSECRET = process.env.GOOGLE_AUTH_CLIENTSECRET;
  var SERVER  = process.env.OPENSHIFT_APP_DNS || "localhost:8080";

  // used to serialize the user for the session
  passport.serializeUser( function( user, done ) {
      done( null, user._id );
  } );

  // used to deserialize the user
  passport.deserializeUser( function( _id, done ) {
      backend.User.findById( _id, done );
  } );

  passport.use(new GoogleStrategy({
      clientID:       CLIENTID,
      clientSecret:   CLIENTSECRET,
      callbackURL:    "http://" + SERVER + "/oauth2callback"
  }, function( token, refreshToken, profile, done ) {
    backend.User.findOne( { "google.id": profile.id }, function( err, user ) {
      if ( err ) {
        return done( err );
      } else if ( user ) {
        return done( null, user );
      } else {
        var newUser = new backend.User( {
          google: {
            emails: [],
            id: profile.id,
            token: token,
            refreshToken: refreshToken
          }
        } );

        profile.emails.forEach( function( email ) {
          newUser.google.emails.push( email.value );
        } );

        newUser.save( function( err ) {
          if ( err ) {
            throw err;
          }
          return done( null, newUser );
        } );
      }
    } );
  } ) );

  app.get( "/auth/google", passport.authenticate( "google", { scope: [ "email" ] } ) );
  app.get( "/oauth2callback", passport.authenticate( "google",
          { successRedirect: successRedirect, failureRedirect: failureRedirect } ) );

    /*  passport.use(new BasicStrategy(function (username, password, done) {
        if (password === "abc" ) { //TODO
          return done(null, { username: username } );
        } else {
          return done(null, false);
        }
      } ));*/
      //self.app.all( "/api/*", passport.authenticate( "basic", { session: false } ));
};
