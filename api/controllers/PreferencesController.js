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
		userId = module.exports.decodeUid(userId);
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
                        userLists.push(list);

						// sets current userPreferences (global variable)
						userPreferences.push(list.value.toString());
					});

					return res.view('preferences/index', {
						// added langPref customer prop - to support text localisation
						langPref: customer.langPref,
						name: customer.name,
						customerId: customerId,
						userId: data.id,
						originalUserId: originalUserId,
						logo: customer.logo,
						header: customer.header,
						subHeader:customer.subHeader,
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
		userId = module.exports.decodeUid(userId);

		var customerId = req.params.customerId;
		var customer = customers[customerId];

		bme.getUser(userId, customer.bmeApiKey, function(data, error) {
			if (error == null) {
				var newContacts = data.contacts.map(function(item, index) {
					var status = item.subscription_status;					
					if(item.contact_type == 'email') {
						status = 'inactive';
					}
					return {
						'contact_type': item.contact_type,
					  'subscription_status': status,
					  'contact_value': item.contact_value				
					}
				});
			
				var preferences = {
					'uid': data.uid,
					'properties': {},
					'contacts': newContacts
				}

				customer.userLists.forEach(function(item) {
					var prop = item.property.split(".");
					//preferences[prop[0]][prop[1]] = 'false';
					//DH - set all properties to '' on unsub - not all props are true/false
					preferences[prop[0]][prop[1]] = '';						
				});

				bme.identifyUser(customer.bmeApiKey, preferences, function(data, error) {
					if (error == null) {
						req.flash("message", "Unsubscribed successfully.");
						if (queryObject.message_uid) {
							module.exports.unsubscribeCount(queryObject.message_uid, customer.name, true);
							userPreferences = module.exports.buildPreferenceValues(preferences);
							return res.redirect(`/preferences/${customerId}/users/${originalUserId}?message_uid=${queryObject.message_uid}`);
						} else {
							return res.redirect(`/preferences/${customerId}/users/${originalUserId}`);
						}
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
		if (queryObject.email) {
			var originalUserId = new Buffer(queryObject.email, 'base64').toString("ascii");
		}
		var userUid = req.params.userId || queryObject.userId;
		userUid = module.exports.decodeUid(userUid);

		var customerId = req.params.customerId;
		var customer = customers[customerId];
		var preferences = this.buildPreferences(req.body, customer.userProperties, customer.userLists);
	
    bme.getUser(userUid, customer.bmeApiKey, function(data, error) {
			if (error == null) {
				var activate = true;	
				var newContacts = data.contacts.map(function(item) {
					var status = item.subscription_status;		
					if(item.contact_type == 'email' && activate) {
						status = 'active';
						activate = false;
					}
					return {
						'contact_type': item.contact_type,
					  'subscription_status': status,
					  'contact_value': preferences.contact_email != undefined ? preferences.contact_email : item.contact_value,		
					}
				});
				preferences['uid'] = userUid;
				preferences['contacts'] = newContacts

				bme.identifyUser(customer.bmeApiKey, preferences, function(data, error) {
					if (error == null) {
						res.json({});
					} else {
						res.json(400, {
							error: error.message
						});
					}
				});

				if (originalUserId) {
					module.exports.trackPreferenceUpdate(customer, originalUserId, req);
				}

				var newPreferences = module.exports.buildPreferenceValues(preferences);
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
	//DH - add function to update user prefs and set status to inactive
	unsubUpdatePreferences: function(req, res) {
    var queryObject = url.parse(req.url, true).query
    if (queryObject.email) {
      var originalUserId = new Buffer(queryObject.email, 'base64').toString("ascii");
    }
    var userUid = req.params.userId || queryObject.userId;    
    userUid = module.exports.decodeUid(userUid);

    var customerId = req.params.customerId;
    var customer = customers[customerId];
    var preferences = this.buildPreferences(req.body, customer.userProperties, customer.userLists);

     bme.getUser(userUid, customer.bmeApiKey, function(data, error) {
      if (error == null) {
      	var inactivate = true;
        var newContacts = data.contacts.map(function(item, index) {
          var status = item.subscription_status;        
          if(item.contact_type == 'email' && inactivate) {
            status = 'inactive';
            inactivate = false;
          }
          return {
            'contact_type': item.contact_type,
            'subscription_status': status,
            'contact_value': preferences.contact_email != undefined ? preferences.contact_email : item.contact_value,      
          }
        });

        preferences['uid'] = userUid;
				preferences['contacts'] = newContacts

        bme.identifyUser(customer.bmeApiKey, preferences, function(data, error) {
          if (error == null) {
            res.json({});
          } else {
            res.json(400, {
              error: error.message
            });
          }
        });

        if (originalUserId) {
          module.exports.trackUnsubUpdate(customer, originalUserId, req);
        }

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
		userId = module.exports.decodeUid(userId);
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
					'uid': data.uid,
					'properties': {}
				}

				var prop = customer.userLists[userListNumber].property.split(".");
				preferences[prop[0]][prop[1]] = 'false';

				bme.identifyUser(customer.bmeApiKey, preferences, function(data, error) {
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

		if (typeof value == 'boolean') {
			return value;
		} else if (!value) {
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
		//DH - update this so all unsubs are attributed to email from where pref center was launched
		//if (message_uid && name == 'Mic') {
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
				console.log('Success');
			});
		}
	},
	trackPreferenceUpdate: function(customer, uid, req) {
		if(customer.bmeApiKey) {
			var properties = {}
			customer.userLists.forEach(function(entry) {
					properties[entry.property.replace('properties.', '')] = req.body[entry.property]
			});

			var updatePreferenceActivity = {
				"activity":{
					"subscriber":{
						"uid":uid
					},
					"event":"updated_preferences",
					"properties": properties
				}
			}

			bme.postSubscriberActivity(customer.bmeApiKey, updatePreferenceActivity, function (data, error) { })
		}
	},
	//DH - add function to post activity on unsub preference selection
	trackUnsubUpdate: function(customer, uid, req) {
		if(customer.bmeApiKey) {
			var properties = {}
			customer.userLists.forEach(function(entry) {
					properties[entry.property.replace('properties.', '')] = req.body[entry.property]
			});

			var updatePreferenceActivity = {
				"activity":{
					"subscriber":{
						"uid":uid
					},
					"event":"track_unsubscribe_reason",
					"properties": properties
				}
			}

			bme.postSubscriberActivity(customer.bmeApiKey, updatePreferenceActivity, function (data, error) { })
		}
	}, 
	decodeUid: function(uid) {
		var sanitizedUid = uid;
		if (uid) {
			if (uid.includes('uid_')) {
				sanitizedUid = uid.replace('uid_', '');
			}

			if (validator.isBase64(sanitizedUid)) {
				sanitizedUid = new Buffer(sanitizedUid, 'base64').toString("ascii");
			}
		}

		return sanitizedUid;
	}

};
