module.exports.routes = {
	'GET /preferences/:customerId/users': 'PreferencesController.index',
	'GET /preferences/:customerId/users/:userId': 'PreferencesController.index',
	'POST /preferences/:customerId/users/:userId': 'PreferencesController.update',
	'GET /usage/bme': 'BmeUsageController.index',
	'GET /usage/bme/billing': 'BmeUsageController.billingData',
};
