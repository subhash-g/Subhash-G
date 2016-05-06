var url = require('url') ;

module.exports = {
  login: function(req, res) {
    return res.view("forbes/login");
  },
  authenticate: function(req, res) {
    if(req.body.user.email == "reports@forbes.com" && req.body.user.password == "b00mtra1n") {
      req.session.forbes_authenticated = true;
      res.redirect("/forbes/reports/email_content");
    }
    else {
      return res.view("forbes/login");
    }
  },
  emailContentReport: function(req, res) {
    if(req.session.forbes_authenticated) {
      return res.view('forbes/email_content_report');
    }
    else {
      return res.redirect("/forbes/login");
    }
  },
  subscribersReport: function(req, res) {
    if(req.session.forbes_authenticated) {
      return res.view('forbes/subscribers_report');
    }
    else {
      return res.redirect("/forbes/login");
    }
  },
  onsiteReport: function(req, res) {
    if(req.session.forbes_authenticated) {
      return res.view('forbes/onsite_report');
    }
    else {
      return res.redirect("/forbes/login");
    }
  },
}