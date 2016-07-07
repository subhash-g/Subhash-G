var url = require('url') ;
var customers = require('../../config/customers');
var bme = require('../../lib/bme');
var validator = require('validator');

module.exports = {

  index: function (req, res) {
	var queryObject = url.parse(req.url,true).query
	var userId = req.params.userId || queryObject.userId || queryObject.email;
	var originalUserId = userId;
	//var listName = customer.userLists[0];
	
	if(userId && validator.isBase64(userId)) {
		userId = new Buffer(userId, 'base64').toString("ascii");
	}
	if(userId.includes('uid_')){
		userId = userId.replace('uid_','');
	}
	var customerId = req.params.customerId;
	var customer = customers[customerId];
	var listName = customer.userLists[1].property.substring(11, customer.userLists[1].property.length);
 
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
					listName: listName,
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

	//console.log(req.params);

	bme.getUser(userId, customer.bmeApiKey, function(data, error) {
		if(error == null) {
			for(var x = 0; x < data.contacts.length; x++){
				if(data.contacts[x].contact_type === 'email'){
					var userSubscriber = data.contacts[x];
					break;
				}
			}

			//console.log(userSubscriber.contact_value);
			//console.log();

			var subscriberProps = {
				'subscriber_contact':{
					'contact_type':'email',
					'contact_value': userSubscriber.contact_value,
					'subscription_status': 'inactive'
				}
			}

			//Prints to the console the properties of 
			/*console.log("userSubscriber.id: \n" + userSubscriber.id + "\n");
			console.log("customer.bmeApiKey: \n" + customer.bmeApiKey + "\n");
			console.log("subscriberProps: ");
			console.log(subscriberProps);
			console.log();*/

			// THIS NEEDS TO BE UNDERSTOOD
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

	console.log(req.body);

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
					// Derek's code to set subscription status to inactive when all boxes are unchecked.
					//'subscription_status':'inactive'
				}
			}

			// Derek's code to set subscription status to inactive when all boxes are unchecked.
			/*for (var i = 0; i < customer.userLists.length; i++) {
				console.log(customer.userLists[i].value);
				if (customer.userLists[i].value === 'true') {
					subscriberProps.subscriber_contact.subscription_status = 'active';
					break;
				}
			}*/

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

			// Derek's code to set subscription status to inactive when all boxes are unchecked.
			/*console.log();
			console.log("SUBSCRIBERPROPS");
			console.log(subscriberProps);

			console.log();
			console.log("DATA.CONTACTS");
			console.log(data.contacts);*/
	});
  },
  singleUnsubscribe: function (req, res) {

  	console.log("Single List Unsub");

	var queryObject = url.parse(req.url,true).query;

	var userId = req.params.userId || queryObject.userId;
	
	var customerId = req.params.customerId;
	var customer = customers[customerId];

	// Must allow for the query field value to dictate which list will be unsubscribed from.
	var listName = customer.userLists[1].property.substring(11, customer.userLists[1].property.length);

	//console.log(queryObject);
	//console.log(queryObject.list);
	//console.log(listName);

	//for (var i = 0; i < customer.userLists.length; i++) {
	//	console.log(customer.userLists[i].value);
	//	if (customer.userLists[i].value === 'true') {
	customer.userLists[1].value = 'false';
	//		subscriberProps.subscriber_contact.subscription_status = 'active';
	//		break;
	//	}
	//}

	for (var i = 0; i < customer.userLists.length; i++) {
		//console.log(customer.userLists[i].value);
	}

	//console.log(req);

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
  buildPreferences: function(data, userProperties, userLists) {
	var result = {};

	// REMOVE ME
	//console.log();
	//console.log("data: ");
	//console.log(data);

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
  printUserListsValues: function(req) {
  	var customerId = req.params.customerId;
  	var customer = customers[customerId];

  	console.log("userLists Values: ")

 	for (var i = 0; i < customer.userLists.length; i++)
		console.log(customer.userLists[i].value);
  }
};