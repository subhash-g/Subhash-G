var url = require('url') ;
var bme = require('../../lib/bme');

module.exports = {

  index: function(req, res) {
    //954b37f3-1c51-4ac7-9868-fce9c75d29ab
    var queryObject = url.parse(req.url,true).query;
    if(queryObject.access_token == "954b37f3-1c51-4ac7-9868-fce9c75d29ab") {
      return res.view('bmeusage/index');
    }
    else {
      return res.view('404');
    }
  },
  billingData: function (req, res) {
    var queryObject = url.parse(req.url,true).query;
	  var cycles = queryObject.cycles;
    
    if(queryObject.access_token == "954b37f3-1c51-4ac7-9868-fce9c75d29ab") {
      bme.getBillingCycles(cycles, function(data, error) {
        if(error == null) {
          res.json(200, data);
        }
        else {
          return res.view('404');
        }
      });
    }
    else {
      return res.view('404');
    }
  }
  
}