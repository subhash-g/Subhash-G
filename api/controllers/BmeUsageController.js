var url = require('url') ;
var bme = require('../../lib/bme');

module.exports = {
  login: function(req, res) {
    return res.view("bmeusage/login");
  },
  authenticate: function(req, res) {
    if(req.body.user.email == "reports@boomtrain.com" && req.body.user.password == "b00mtra1n") {
      req.session.authenticated = true;
      res.redirect("/usage/bme");
    }
    else {
      return res.view("bmeusage/login");
    }
  },
  index: function(req, res) {
    if(req.session.authenticated) {
      return res.view('bmeusage/index');
    }
    else {
      return res.redirect("/usage/bme/login");
    }
  },
  topSenders: function(req, res) {
    if(req.session.authenticated) {
      return res.view('bmeusage/top_senders');
    }
    else {
      return res.redirect("/usage/bme/login");
    }
  },
  topSubscribers: function(req, res) {
    if(req.session.authenticated) {
      return res.view('bmeusage/top_subscribers');
    }
    else {
      return res.redirect("/usage/bme/login");
    }
  },
  billingData: function (req, res) {
    var queryObject = url.parse(req.url,true).query;
	  var cycles = queryObject.cycles;
    
    if(req.session.authenticated) {
      bme.getBillingCycles(cycles, function(data, error) {
        if(error == null) {
          //console.log(JSON.stringify(data));
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