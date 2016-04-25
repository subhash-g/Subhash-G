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
	getBillingCycles: function(cycles, callback) {
		var customers = {};
		this.getBillingCyclesHelper(0, cycles, customers, callback);
	},
	getBillingCyclesHelper: function(cycle, totalCycles, customers, callback) {
		this.getBillingData(totalCycles-cycle, function(data, error) {
			if(error == null) {
				module.exports.mergeBillingData(customers, data, cycle);
				
				if(cycle < totalCycles) {
					module.exports.getBillingCyclesHelper(cycle+1, totalCycles, customers, callback);
				}
				else {
					callback(customers, null);
				}
			}
			else {
				callback(null, error);
			}
		});
	},
	mergeBillingData: function(customers, billingData, cycle) {
		billingData.forEach(function(item, i) {
			var accountKey = item["account_key"];
			var url = item["url"];
			
			if(!customers[accountKey]) {
				customers[accountKey] = {
					"account_key": accountKey,
					"url": url,
					"cycles": {}
				};
			}
			
			customers[accountKey]["cycles"][cycle] = {
				"billing_date": item["billing_date_key"],
				"active_subscribers": item["num_active_subscribers"],
				"subscribers": item["num_subscribers"],
				"emails": item["num_emails"],
				"inapps": item["num_inapps"],
				"push_notifications": item["num_push_notifications"],
				"smses": item["num_smses"],
				"webhooks": item["num_webhooks"]
			};
		});
	},
	getBillingData: function(cyclesAgo, callback) {
		var options = this.defaultOptions();
		options.path = '/partner/boomtrain/admin/stats/billing?cycles_ago=' + cyclesAgo;
		options.method = 'GET';
		options.headers['Authorization'] = 'Basic YXBpOjU1MzI0ODFmYzUxNWNiZmJjNzdkMWE4NzA4YTE1NjI3'; 
		
		client.executeRequest(options, null, callback);
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