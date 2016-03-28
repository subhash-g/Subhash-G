var https = require('https');

module.exports = {
	executeRequest: function(options, body, callback) {
		var req = https.request(options, function(res) {
			var results = '';
			res.on('data', function (chunk) {
			    results = results + chunk;
		    }); 
			res.on('end', function () {
				if(res.statusCode == 200) {
					var data = JSON.parse(results);
					callback(data, null);
				}
				else {
					callback(null, new Error('Server returned ' + res.statusCode));
				}
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