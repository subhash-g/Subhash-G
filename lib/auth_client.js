var client = require('../lib/rest_client');
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
		
		client.executeRequest(options, body, callback);
	  }
}