var Heuristics = function() {
  var self = this;


  self.applyLinkHeuristics = function( href, card, link, contentResponse, contentBody ) {
    //TODO apply other heuristics, such as recognizing YouTube Videos (create specifically typed links), Salesforce links (create oppty or customer links)

  };


  self.applyCardHeuristics = function( board, oldList, oldCard, newList, newCard ) {

    //if list changed
    if (oldList.instanceid !== newList.instanceid) {
      var now = new Date();

      if (! newCard.attribute) {
        newCard.attribute = {};
      }

      if (oldList.attribute["*TRACK"]) {
        var val = newCard.attribute[oldList.attribute["*TRACK"]];
        if ( !val ) {
          val = { type: "mykanban/track" };
        }
        val.exit = now;
        //passing dates back and forth converts them to strings
        //convert them back if necessary to allow duration calculation
        if ( val.entry && typeof val.entry === "string" ) {
          val.entry = new Date(val.entry);
        }
        val.duration = ((val.duration)?val.duration:0) + (val.entry)?(val.exit - val.entry):0;
        val.containedBy = oldList.instanceid;
        newCard.attribute[oldList.attribute["*TRACK"]] = val;
      }
      if (newList.attribute["*TRACK"]) {
        var val = newCard.attribute[newList.attribute["*TRACK"]];
        if ( !val ) {
          val = { type: "mykanban/track" };
        }
        val.entry = now;
        val.containedBy = newList.instanceid;
        newCard.attribute[newList.attribute["*TRACK"] ] = val;
      }
    }
  };

};

module.exports = new Heuristics();
