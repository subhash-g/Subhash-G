var client = require('../lib/rest_client');
var btoa = require('btoa');
var config = require('../config/bme');

module.exports = {
	getUser: function(userId, apiKey, callback) {
		var options = this.defaultOptions(apiKey);
		options.path = '/201507/subscribers?uid=' + encodeURIComponent(userId);
		options.method = 'GET';

		client.executeRequest(options, null, callback);
	},
	updateUser: function(userId, apiKey, properties, callback) {
		var options = this.defaultOptions(apiKey);
		options.path = '/201507/subscribers/' + userId;
		options.method = 'PUT';
		client.executeRequest(options, properties, callback);
	},
	updateSubscriber: function(userSubscriberId, apiKey, properties, callback){
		var options = this.defaultOptions(apiKey);
		options.path = '/201507/subscriber_contacts/' + userSubscriberId;
		options.method = 'PUT';
		client.executeRequest(options, properties, callback);
	},
	postSubscriberActivity: function(apiKey, properties, callback){
		var options = this.defaultOptions(apiKey);
		options.path = '/201507/activities';
		options.method = 'POST';
		client.executeRequest(options, properties, callback);
	},
	getBillingCycles: function(cycles, callback) {
		var customers = {};
		this.getBillingCyclesHelper(0, cycles, customers, callback);
	},
	getBillingCyclesHelper: function(cycle, totalCycles, customers, callback) {
		this.getBillingData(totalCycles-cycle, function(data, error) {
			if(error == null) {
				module.exports.mergeBillingData(customers, data, cycle, totalCycles);

				if(cycle < totalCycles) {
					module.exports.getBillingCyclesHelper(cycle+1, totalCycles, customers, callback);
				}
				else {
					module.exports.aggregateCycles(customers, totalCycles);
					callback(customers, null);
				}
			}
			else {
				callback(null, error);
			}
		});
	},
	aggregateCycles: function(customers, totalCycles) {
		var aggregatedCustomer = {
			"account_key": "ALL",
			"url":"ALL ACCOUNTS",
			"cycles": {}
		};

		for(var cycle = 0; cycle <= totalCycles; cycle++) {
			var monthsAgo = totalCycles-cycle;
			var cycleDate = new Date();
			cycleDate.setDate(1);
			cycleDate.setMonth(cycleDate.getMonth()-monthsAgo);

			var strMonth = (cycleDate.getMonth()+1).toString();
			var strYear = cycleDate.getFullYear().toString();
			var cycleKey = strYear+"-"+strMonth;

			aggregatedCustomer["cycles"][cycleKey] = {
				"billing_date": cycleDate,
				"active_subscribers": 0,
				"subscribers": 0,
				"emails": 0,
				"inapps": 0,
				"push_notifications": 0,
				"smses": 0,
				"webhooks": 0
			};

			var accountKeys = Object.keys(customers);
			accountKeys.forEach(function(accountKey, i) {
				var customer = customers[accountKey];
				var cycle = customer["cycles"][cycleKey];
				if(cycle) {
					aggregatedCustomer["cycles"][cycleKey]["active_subscribers"] += cycle["active_subscribers"];
					aggregatedCustomer["cycles"][cycleKey]["subscribers"] += cycle["subscribers"];
					aggregatedCustomer["cycles"][cycleKey]["emails"] += cycle["emails"];
					aggregatedCustomer["cycles"][cycleKey]["inapps"] += cycle["inapps"];
					aggregatedCustomer["cycles"][cycleKey]["push_notifications"] += cycle["push_notifications"];
					aggregatedCustomer["cycles"][cycleKey]["smses"] += cycle["smses"];
					aggregatedCustomer["cycles"][cycleKey]["webhooks"] += cycle["webhooks"];
				}
				else {
					customer["cycles"][cycleKey] = {
						"billing_date": cycleDate,
						"active_subscribers": 0,
						"subscribers": 0,
						"emails": 0,
						"inapps": 0,
						"push_notifications": 0,
						"smses": 0,
						"webhooks": 0
					};
				}
			});
		}

		customers["ALL"] = aggregatedCustomer;
	},
	mergeBillingData: function(customers, billingData, cycle, totalCycles) {
		var monthsAgo = totalCycles-cycle;
		var cycleDate = new Date();
		cycleDate.setDate(1);
		cycleDate.setMonth(cycleDate.getMonth()-monthsAgo);

		var strMonth = (cycleDate.getMonth()+1).toString();
		var strYear = cycleDate.getFullYear().toString();
		var cycleKey = strYear+"-"+strMonth;

		console.log("START*******" + cycleKey);
		console.log(JSON.stringify(billingData));
		console.log("END*******" + cycleKey);

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

			var billingDateYear = item["billing_date_key"].toString().substring(0, 4);
			var billingDateMonth = item["billing_date_key"].toString().substring(4, 6);
			var billingDateKey = billingDateYear + "-" + parseInt(billingDateMonth).toString();

			if(billingDateKey == cycleKey) {
				customers[accountKey]["cycles"][cycleKey] = {
					"billing_date": cycleDate,
					"active_subscribers": item["num_active_subscribers"],
					"subscribers": item["num_subscribers"],
					"emails": item["num_emails"],
					"inapps": item["num_inapps"],
					"push_notifications": item["num_push_notifications"],
					"smses": item["num_smses"],
					"webhooks": item["num_webhooks"]
				};
			}
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
