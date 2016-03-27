var https = require('https');
var btoa = require('btoa');
var config = require('../config/bme');

module.exports = {
	getUser: function(userId, apiKey, callback) {
		var options = this.defaultOptions(apiKey);
		options.path = '/201507/subscribers?uid=' + userId;
		options.method = 'GET';
		
		this.executeRequest(options, null, callback);
	  },
	updateUser: function(userId, apiKey, properties, callback) {
		var options = this.defaultOptions(apiKey);
		options.path = '/201507/subscribers/' + userId;
		options.method = 'PUT';

		this.executeRequest(options, properties, callback);
	},
	defaultOptions: function(apiKey) {
		return {
		  hostname: config.hostname,
		  port: 443,
		  headers: {
			'Authorization': 'Basic ' + btoa("api:" + apiKey),
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		  }
		};
	},
	executeRequest: function(options, body, callback) {
		var req = https.request(options, function(res) {
			var results = '';
			res.on('data', function (chunk) {
			    results = results + chunk;
		    }); 
			res.on('end', function () {
				console.log(res.statusCode);
				console.log(results);
				var data = JSON.parse(results);
				callback(data, null);
			});
		});
		
		req.on('error', function(error) {
		  callback(null, error);
		});

		if(body != null) {
			req.end(JSON.stringify(body));
		}
		else {
			req.end();
		}
	},
}