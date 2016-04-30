module.exports.routes = {
	'GET /preferences/:customerId/users': 'PreferencesController.index',
	'GET /preferences/:customerId/users/:userId': 'PreferencesController.index',
	'POST /preferences/:customerId/users/:userId': 'PreferencesController.update',
	'GET /usage/bme/login': 'BmeUsageController.login',
	'POST /usage/bme/login': 'BmeUsageController.authenticate',
	'GET /usage/bme/billing': 'BmeUsageController.billingData',
	'GET /usage/bme': 'BmeUsageController.index',
	'GET /usage/bme/top_senders': 'BmeUsageController.topSenders',
	'GET /usage/bme/top_subscribers': 'BmeUsageController.topSubscribers',
};
