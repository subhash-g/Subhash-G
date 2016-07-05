// What is meaning of the text included within the single quotes?
var url = require('url') ;
var customers = require('../../config/customers');
var bme = require('../../lib/bme');
var validator = require('validator');

module.exports = {

  index: function (req, res) {
	var queryObject = url.parse(req.url,true).query

	console.log(req);

	//REMOVE ME
	console.log(queryObject);

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

  	//Creates an object queryObject parsed from req.url. The query property will be set to an object returned by the 
  	//querystring module's parse() method. 
	var queryObject = url.parse(req.url,true).query

	// Creates an object userId set to the userId of req (the object contraining information abotu the HTTP request that
	// raised the event) of the userId of queryObject (the object ???)
	var userId = req.params.userId || queryObject.userId;
	
	// Creates an object customerId set to req's (the object containing information about the HTTP reuqest that 
	// raised the event) of params field's customerIF field. 
	var customerId = req.params.customerId;

	// Creates an object customer set to the customerId element within customers.js
	var customer = customers[customerId];

	// Creates an object preferences. Calls the buildPreferences helper method with arguments req.body (data), 
	// customer.userProperties (userProperties), and customer.userLists (userLists). req.body is ???, 
	// customer.userProperties is ???, and customer.userLists is ???. 
	//
	// Q - What is this in this case and why is buildPreferences called on this while other helper methods are called on 
	// module.exports?
	var preferences = this.buildPreferences(req.body, customer.userProperties, customer.userLists);
	
	// Calls updateUser upon the bme object. userId is ???, customer. bmeApiKey is ???, preferences is the property to be updated
	// and the callback function is:
	bme.updateUser(userId, customer.bmeApiKey, preferences, function(data, error) {

		console.log(data);

		// If error is null
		if(error == null) {

			// Iterate over the length of data's contacts array. 
			for(var x = 0; x < data.contacts.length; x++){

				// If an element within the contacts array has a contact_type of 'email'...
				if(data.contacts[x].contact_type === 'email'){

					// Create a variable userSubscriber set to the current element within the contacts array and break.
					var userSubscriber = data.contacts[x];
					break;
				}
			}

			// Create an object subscriberProps with the key object subscriber_contact.
			var subscriberProps = {

				// Creates an object subscriber_contact with keys contact_type, contact_value, and subscription_status
				'subscriber_contact':{

					// Set contact_type to 'email'
					'contact_type':'email',

					// If preferences's contact_email field is not undefined, set contact_value to preferences's
					// contact email field, otherwise set contact_value to userSubscriber's contact_value field. 
					'contact_value':preferences.contact_email != undefined ? preferences.contact_email : userSubscriber.contact_value,
					
					// Set subscription_status to 'active'
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

  /* Called in the update function when instantiating object preferences. 
	- data : array 
	- userProperties : ?
	- userLists : ?
  */
  buildPreferences: function(data, userProperties, userLists) {

  	// Creates an object result. 
	var result = {};

	// Uses a callback function for userProperties. Executes the inner code once per array element. (What array are 
	// we in reference to?)
	userProperties.forEach(function(item) {

		// Creates a variable value set to the property field of item within the data array. Where is the data array
		// and how do we refer to it?
		var value = data[item.property];

		// Calls setUserPropertyVale on module.exports with arguments result, item.property and value. result is ???, 
		// item.property is ???, and value is ???. 
		module.exports.setUserPropertyValue(result, item.property, value);
	});
	
	userLists.forEach(function(item) {
		var value = data[item.property];
		module.exports.setUserPropertyValue(result, item.property, value);
	});
	
	return result;
  },

  /* 
  	Called in the buildPreferences function.

  	- data : array 
  	- property : string that is delimited by periods
  	- value : ?
  */
  setUserPropertyValue: function(data, property, value) {

  	// Creates an array path set to the property string delimited by periods. 
	var path = property.split(".");

	// Calls setUserProperty value. data is ???, path is ???, value is ???, and 1
	this.setUserPropertyValueHelper(data, path, value, 1);
  },

  /*
	Called by the setUserPropertyValue function.
	
	- data : array 
	- path : array 
	- value : variable in which the data array's element at index key may be set to. 
	- depth : integer 
  */
  setUserPropertyValueHelper: function(data, path, value, depth) {

  	// Creates a variable key that is the depth - 1st element within the path array. 
	var key = path[depth-1];
	
	// If the capacity of the path array is equal to the depth value, set the data array's element at index key to 
	// value. 
	if(path.length == depth) {
		data[key] = value;
	}

	// Otherwise if the data array's element at index key is null, set the value of the data array at index key to {}
	// What is {}?
	else {
		if(data[key] == null) {
			data[key] = {};
		}
		
		// Recursively call the setUserPropertyValue Helper method witht the depth incremented by one. 
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

  // Derek's tests, delete this later!
  derekTest: function() {
  	console.log(url.parse(req.url,true).query);
  }

};