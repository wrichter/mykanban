var Heuristics = function() {
  var self = this;


  self.applyLinkHeuristics = function(href, card, link, contentResponse, contentBody) {
    //TODO apply other heuristics, such as recognizing YouTube Videos (create specifically typed links), Salesforce links (create oppty or customer links)

  };
};

module.exports = new Heuristics();
