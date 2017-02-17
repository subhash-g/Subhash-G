var url = require('url');
var customers = require('../../config/customers');
var bme = require('../../lib/bme');
var validator = require('validator');
var request = require('request');

var userPreferences = []; 

module.exports = {

	index: function(req, res) {
		var queryObject = url.parse(req.url, true).query;
		
		if (queryObject.email) {
			queryObject.email = queryObject.email.replace(' ', '+');
		}
		
		var userId = req.params.userId || queryObject.userId || queryObject.email;
		var originalUserId = userId;

		//console.log(queryObject)

		if (userId && validator.isBase64(userId)) {
			userId = new Buffer(userId, 'base64').toString("ascii");
		}
		if (userId.includes('uid_')) {
			userId = userId.replace('uid_', '');
		}
		var customerId = req.params.customerId;
		var customer = customers[customerId];
		if (customer == null) {
			return res.view('404', {})
		}
		var barStatus = undefined;

		var singleUnsubListName = queryObject.unsubscribe;

		for (var i = 0; i < customer.userLists.length; i++) {
			var listName = customer.userLists[i].property.split(".");
			var listProp = listName[1];
			if (singleUnsubListName === listProp) {
				barStatus = true;
				break;
			}
		}
		if (barStatus === undefined)
			barStatus = false;

		if (customer) {

			bme.getUser(userId, customer.bmeApiKey, function(data, error) {
				if (error == null) {
					var userProperties = [];
					customer.userProperties.forEach(function(prop) {
						if (prop.property == "contact_email") {
							for (var i = 0; i < data.contacts.length; i++) {
								if (data.contacts[i].contact_type == "email") {
									prop.value = data.contacts[i].contact_value;
									break;
								}
							}
						} else {
							prop.value = module.exports.getUserPropertyValue(data, prop.property);
						}
						userProperties.push(prop);
					});

					var userLists = [];
					customer.userLists.forEach(function(list) {
						list.value = module.exports.getUserPropertyValue(data, list.property);
						if (typeof list.value == 'boolean')
							list.value = list.value.toString();
						else if (Array.isArray(list.value))
							list.value.forEach(function(item) {
								listList = {
									name: item,
									property: list.property,
									value: item,
									type: 'array'
								}
								userLists.push(listList)
							});
						else if (list.value !== '')
							// TODO: Jenky. Assumes that empty string means skip.
							userLists.push(list);

						// sets current userPreferences (global variable)
						userPreferences.push(list.value.toString());
					});

					return res.view('preferences/index', {
						name: customer.name,
						customerId: customerId,
						userId: data.id,
						originalUserId: originalUserId,
						logo: customer.logo,
						header: customer.header,
						profile: userProperties,
						lists: userLists,
						unsubListName: singleUnsubListName,
						unsubStatus: barStatus
					});
				} else {
					return res.view('404-UserDoesNotExist', {
						incorrectUser: userId,
						logo: customer.logo
					});
				}
			});
		} else {
			return res.view('404', {});
		}
	},
	unsubscribeAll: function(req, res) {
		var queryObject = url.parse(req.url, true).query
		var userId = req.params.userId || queryObject.userId;
		var originalUserId = userId;

		if (userId && validator.isBase64(userId)) {
			userId = new Buffer(userId, 'base64').toString("ascii");
		}

		if (userId.includes('uid_')) {
			userId = userId.replace('uid_', '');
		}
		var customerId = req.params.customerId;
		var customer = customers[customerId];

		console.log(queryObject);

		bme.getUser(userId, customer.bmeApiKey, function(data, error) {
			if (error == null) {
				for (var x = 0; x < data.contacts.length; x++) {
					if (data.contacts[x].contact_type === 'email') {
						var userSubscriber = data.contacts[x];
						break;
					}
				}

				var subscriberProps = {
					'subscriber_contact': {
						'contact_type': 'email',
						'contact_value': userSubscriber.contact_value,
						'subscription_status': 'inactive'
					}
				}

				bme.updateSubscriber(userSubscriber.id, customer.bmeApiKey, subscriberProps, function(data, error) {
					if (error == null) {

						var preferences = {
							'properties': {}
						}

						customer.userLists.forEach(function(item) {
							var prop = item.property.split(".");
							preferences[prop[0]][prop[1]] = 'false';
						});
						req.flash("message", "Preferences successfully updated.");
						bme.updateUser(data.subscriber.id, customer.bmeApiKey, preferences, function(data, error) {
							if (queryObject.message_uid) {
								module.exports.unsubscribeCount(queryObject.message_uid, customer.name, true);
								userPreferences = module.exports.buildPreferenceValues(preferences);
								return res.redirect(`/preferences/${customerId}/users/${originalUserId}?message_uid=${queryObject.message_uid}`);
							} else {
								return res.redirect(`/preferences/${customerId}/users/${originalUserId}`);
							}
						});
					
					} else {
						req.flash("message", "Error: problem with updating preferences.");
						return res.redirect(`/preferences/${customerId}/users/${originalUserId}`);
					}
				});
				
			} else {
				return res.redirect(`/preferences/${customerId}/users/${originalUserId}`);
			}
		});
	},
	update: function(req, res) {

		var queryObject = url.parse(req.url, true).query
		var userId = req.params.userId || queryObject.userId;
		console.log(queryObject);

		var customerId = req.params.customerId;
		var customer = customers[customerId];

		var preferences = this.buildPreferences(req.body, customer.userProperties, customer.userLists);
		bme.updateUser(userId, customer.bmeApiKey, preferences, function(data, error) {
			if (error == null) {

				for (var x = 0; x < data.contacts.length; x++) {
					if (data.contacts[x].contact_type === 'email') {
						var userSubscriber = data.contacts[x];
						break;
					}
				}
				var subscriberProps = {
					'subscriber_contact': {
						'contact_type': 'email',
						'contact_value': preferences.contact_email != undefined ? preferences.contact_email : userSubscriber.contact_value,
						'subscription_status': 'active'
					}
				}

				bme.updateSubscriber(userSubscriber.id, customer.bmeApiKey, subscriberProps, function(data, error) {

					if (error == null) {
						res.json({});
					} else {
						res.json(400, {
							error: error.message
						});
					}
				});

				var newPreferences = module.exports.buildPreferenceValues(preferences);
				//console.log(userPreferences);
				//console.log(newPreferences);
				//console.log(module.exports.changeInPreferences(userPreferences, newPreferences));
				if (module.exports.changeInPreferences(userPreferences, newPreferences)) {
					module.exports.unsubscribeCount(queryObject.message_uid, customer.name, false);
				}
				userPreferences = newPreferences;
			
			} else {
				res.json(400, {
					error: error.message
				});
			}
		});
	},
	singleUnsubscribe: function(req, res) {

		var queryObject = url.parse(req.url, true).query;
		console.log("singleUnsubscribe");
		console.log(queryObject);

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
			return res.redirect(`/preferences/${customerId}/users/${originalUserId}?unsubscribe=error`);
		}

		bme.getUser(userId, customer.bmeApiKey, function(data, error) {
			if (error == null) {
				var preferences = {
					'properties': {}
				}

				var prop = customer.userLists[userListNumber].property.split(".");
				preferences[prop[0]][prop[1]] = 'false';

				bme.updateUser(data.id, customer.bmeApiKey, preferences, function(data, error) {	
					if(queryObject.message_uid) {
						module.exports.unsubscribeCount(queryObject.message_uid, customer.name, false);
						return res.redirect(`/preferences/${customerId}/users/${originalUserId}?unsubscribe=${listProp}&message_uid=${queryObject.message_uid}`);
					} else {
						return res.redirect(`/preferences/${customerId}/users/${originalUserId}?unsubscribe=${listProp}`);
					}
				});

				//module.exports.unsubscribeCount(message_uid, customer.name);

			} else {
				return res.redirect(`/preferences/${customerId}/users/${originalUserId}?unsubscribe=error`);
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
		var key = path[depth - 1];
		if (path.length == depth) {
			data[key] = value;
		} else {
			if (data[key] == null) {
				data[key] = {};
			}

			this.setUserPropertyValueHelper(data[key], path, value, depth + 1);
		}
	},
	getUserPropertyValue: function(data, property) {
		var path = property.split(".");
		return this.getUserPropertyValueHelper(data, path, 1);
	},
	getUserPropertyValueHelper: function(data, path, depth) {
		var key = path[depth - 1];
		var value = data[key];

		if (!value) {
			return '';
		} else if (path.length == depth) {
			return value || '';
		} else {
			return this.getUserPropertyValueHelper(value, path, depth + 1);
		}
	},
	buildPreferenceValues: function(preferences) {
		var list = [];
		for (var key in preferences.properties) {
			list.push(preferences.properties[key]);
		}
		return list; 
	},
	changeInPreferences: function(oldList, newList) {
		// check if there is change in user list
		for (var i = 0; i < oldList.length; i++) {
			if (oldList[i] != newList[i] && newList[i] == 'false') {
				return true; 
			}
		}
		return false;

	},
	unsubscribeCount: function(message_uid, name, unsubscribe) {
		// unsubscribe event count, only enabled for Mic.com currently
		console.log("messsage_uid: " + message_uid);
		if (message_uid && name == 'Mic') {
			var options = {
				method: 'POST',
				url: 'https://track.nudgespot.com/sendgrid/message_events',
				headers: {
					accept: 'application/json',
					'content-type': 'application/json'
				},
				body: {
					_json: [{
						'event': 'unsubscribed',
						'mail_id': message_uid,
						'unsubscribe_contact': unsubscribe,
						'timestamp': parseInt((Date.now() / 1000), 10)
					}]
				},
				json: true
			};

			request(options, function(error, response, body) {
				if (error) {
					throw new Error(error);
				}
				//console.log(response);
				console.log('Success');
			});
		}
	},
};
