var url = require('url') ;
var customers = require('../../config/customers');
var bme = require('../../lib/bme');

module.exports = {

  index: function (req, res) {
	var queryObject = url.parse(req.url,true).query
	var userId = req.params.userId || queryObject.userId;
	
	var customerId = req.params.customerId;
	var customer = customers[customerId];
	
	if (customer) {
		bme.getUser(userId, customer.bmeApiKey, function(data, error) {
			if(error == null) {
				var userProperties = [];
				customer.userProperties.forEach(function(prop) {
					prop.value = module.exports.getUserPropertyValue(data, prop.property);
					userProperties.push(prop);
				});

				var userLists = [];
				customer.userLists.forEach(function(list) {
					list.value = module.exports.getUserPropertyValue(data, list.property);
					userLists.push(list);
				});

				return res.view('preferences/index', {
					name: customer.name,
					customerId: customerId,
					userId: data.id,
					logo: customer.logo,
					profile: userProperties,
					lists: userLists
				});
			}
			else {
				return res.view('404');
			}
		});
	}
	else {
		res.view('404');
	}
  },
  update: function (req, res) {
	var queryObject = url.parse(req.url,true).query
	var userId = req.params.userId || queryObject.userId;

	var customerId = req.params.customerId;
	var customer = customers[customerId];

	var preferences = this.buildPreferences(req.body, customer.userProperties, customer.userLists);
	
	bme.updateUser(userId, customer.bmeApiKey, preferences, function(data, error) {
		if(error == null) {
			res.json({});
		}
		else {
			res.json({
				error: error.message
			});
		}
	});
  },
  buildPreferences: function(data, userProperties, userLists) {
	var result = {};
	userProperties.forEach(function(item) {
		var value = data[item.property];
		module.exports.setUserPropertyValue(result, item.property, value);
	});
	
	userLists.forEach(function(item) {
		var value = data[item.property];
		module.exports.setUserPropertyValue(result, item.property, value);
	});
	
	return result;
  },
  setUserPropertyValue: function(data, property, value) {
	var path = property.split(".");
	this.setUserPropertyValueHelper(data, path, value, 1);
  },
  setUserPropertyValueHelper: function(data, path, value, depth) {
	var key = path[depth-1];
	
	if(path.length == depth) {
		data[key] = value;
	}
	else {
		if(data[key] == null) {
			data[key] = {};
		}
		
		this.setUserPropertyValueHelper(data[key], path, value, depth+1);
	}
  },
  getUserPropertyValue: function(data, property) {
	var path = property.split(".");
	return this.getUserPropertyValueHelper(data, path, 1);
  },
  getUserPropertyValueHelper: function(data, path, depth) {
	var key = path[depth-1];
	var value = data[key];
	
	if(!value) {
		return '';
	}
	else if(path.length == depth) {
		return value || '';
	}
	else {
		return this.getUserPropertyValueHelper(value, path, depth+1);
	}
  },

};