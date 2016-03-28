var client = require('../lib/rest_client');
var btoa = require('btoa');
var config = require('../config/bme');

module.exports = {
	getUser: function(userId, apiKey, callback) {
		var options = this.defaultOptions(apiKey);
		options.path = '/201507/subscribers?uid=' + userId;
		options.method = 'GET';
		
		client.executeRequest(options, null, callback);
	  },
	updateUser: function(userId, apiKey, properties, callback) {
		var options = this.defaultOptions(apiKey);
		options.path = '/201507/subscribers/' + userId;
		options.method = 'PUT';

		client.executeRequest(options, properties, callback);
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
}