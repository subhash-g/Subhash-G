var https = require('https');
var config = require('../config/auth0');

module.exports = {
	authenticateUser: function(username, password, callback) {
		var options = {
		  hostname: config.hostname,
		  path: config.path,
		  port: 443,
		  method: 'POST',
		  headers: {
			'Content-Type': 'application/json'
		  },
		};

		var body = {  
			"client_id": config.clientId,  
			"username": username,  
			"password": password,  
			"connection": config.connection,  
			"scope": config.scope,  
			"grant_type": config.grantType, 
			"device": "" 
		};

		var req = https.request(options, function(res) {
			var results = '';
			res.on('data', function (chunk) {
			    results = results + chunk;
		    }); 
			res.on('end', function () {
				var data = JSON.parse(results);
				callback(data, null);
			});
		});

		req.end(JSON.stringify(body));
		req.on('error', function(e) {
		  callback(null, e);
		});
	  }
}