var url = require('url') ;
var customers = require('../../config/customers');
var bme = require('../../lib/bme');
var validator = require('validator');

module.exports = {

  index: function (req, res) {
	var queryObject = url.parse(req.url,true).query
	var userId = req.params.userId || queryObject.userId || queryObject.email;
	var originalUserId = userId;
	
	if(userId && validator.isBase64(userId)) {
		userId = new Buffer(userId, 'base64').toString("ascii");
	}
	if(userId.includes('uid_')){
		userId = userId.replace('uid_','');
	}
	var customerId = req.params.customerId;
	var customer = customers[customerId];

	if (customer) {
		bme.getUser(userId, customer.bmeApiKey, function(data, error) {
			if(error == null) {
				var userProperties = [];
				customer.userProperties.forEach(function(prop) {
					if(prop.property == "contact_email") {
						for(var i = 0; i < data.contacts.length; i++) {
							if(data.contacts[i].contact_type == "email") {
								prop.value = data.contacts[i].contact_value;
								break;
							}
						}
					}
					else {
						prop.value = module.exports.getUserPropertyValue(data, prop.property);
					}
					userProperties.push(prop);
				});

				var userLists = [];
				customer.userLists.forEach(function(list) {
					list.value = module.exports.getUserPropertyValue(data, list.property);
					if(typeof list.value == 'boolean') 
						list.value = list.value.toString();
					userLists.push(list);
				});

				return res.view('preferences/index', {
					name: customer.name,
					customerId: customerId,
					userId: data.id,
					originalUserId: originalUserId,
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
  unsubscribeAll: function(req, res) {
	var queryObject = url.parse(req.url,true).query
	var userId = req.params.userId || queryObject.userId;
	var originalUserId = userId;
	if(userId && validator.isBase64(userId)) {
		userId = new Buffer(userId, 'base64').toString("ascii");
	}

	if(userId.includes('uid_')){
		userId = userId.replace('uid_','');
	}
	var customerId = req.params.customerId;
	var customer = customers[customerId];

	bme.getUser(userId, customer.bmeApiKey, function(data, error) {
		if(error == null) {
			for(var x = 0; x < data.contacts.length; x++){
				if(data.contacts[x].contact_type === 'email'){
					var userSubscriber = data.contacts[x];
					break;
				}
			}

			var subscriberProps = {
				'subscriber_contact':{
					'contact_type':'email',
					'contact_value': userSubscriber.contact_value,
					'subscription_status': 'inactive'
				}
			}

			bme.updateSubscriber(userSubscriber.id, customer.bmeApiKey, subscriberProps, function(data, error){
				if(error == null) {

					var preferences = {'properties':{}}

					customer.userLists.forEach(function(item){
						var prop = item.property.split(".");
						preferences[prop[0]][prop[1]] = 'false';
					});

					bme.updateUser(data.subscriber.id, customer.bmeApiKey, preferences, function(data, error) {
						return res.redirect(`/preferences/${customerId}/users/${originalUserId}`);
					});
				}
				else {
					return res.redirect(`/preferences/${customerId}/users/${originalUserId}`);
				}

				
			});
		}
		else {
			return res.redirect(`/preferences/${customerId}/users/${originalUserId}`);
		}
	});
  },
  update: function (req, res) {

	var queryObject = url.parse(req.url,true).query
	var userId = req.params.userId || queryObject.userId;
	
	var customerId = req.params.customerId;
	var customer = customers[customerId];

	var preferences = this.buildPreferences(req.body, customer.userProperties, customer.userLists);
	bme.updateUser(userId, customer.bmeApiKey, preferences, function(data, error) {
		if(error == null) {

			for(var x = 0; x < data.contacts.length; x++){
				if(data.contacts[x].contact_type === 'email'){
					var userSubscriber = data.contacts[x];
					break;
				}
			}
			var subscriberProps = {
				'subscriber_contact':{
					'contact_type':'email',
					'contact_value':preferences.contact_email != undefined ? preferences.contact_email : userSubscriber.contact_value,
					'subscription_status': 'active'
				}
			}

			bme.updateSubscriber(userSubscriber.id, customer.bmeApiKey, subscriberProps, function(data, error){

				if(error == null) {
					res.json({});
				}
				else {
					res.json(400, {
						error: error.message
					});
				}
			});
		}
		else {
			res.json(400, {
				error: error.message
			});
		}
	});
  },
  singleUnsubscribe: function (req, res) {

	var queryObject = url.parse(req.url,true).query;

	var userId = req.params.userId || queryObject.userId;
	var originalUserId = userId;
	
	var customerId = req.params.customerId;
	var customer = customers[customerId];

	for (var i = 0; i < customer.userLists.length; i++) {
		var listName = customer.userLists[i].property.split(".");
		var listProp = listName[1];
		if (queryObject.list === listProp) {
			var correctURL = true;
			var userListNumber = i;
			break;
		}
	}

	if (!correctURL) {
		return res.view('404');
	}

	bme.getUser(userId, customer.bmeApiKey, function(data, error) {
		if(error == null) {
			var preferences = {
				'properties':{}
			}

			var prop = customer.userLists[userListNumber].property.split(".");
			preferences[prop[0]][prop[1]] = 'false';

			bme.updateUser(data.id, customer.bmeApiKey, preferences, function(data, error) {
				return res.redirect(`/preferences/${customerId}/users/${originalUserId}`);
			});
		}
		else {
			return res.redirect(`/preferences/${customerId}/users/${originalUserId}`);
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