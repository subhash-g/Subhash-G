var customers = require('../../config/customers');
var authClient = require('../../lib/auth_client');

module.exports = {

  index: function (req, res) {
	var customer = customers[req.params.customerId];
	
	authClient.authenticateUser(customer.username, customer.password, function(data, error) {
		if(error == null) {
			var jwt = data["id_token"];
			return res.view('reports/index', {
				name: customer.name,
				jwt: jwt,
				apiKey: customer.stationApiKey,
				appId: customer.stationAppId
			});
		}
		else {
			console.log(error.message);
			//TODO: Handle Error Condition
		}
	});	
  }

};

