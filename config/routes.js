module.exports.routes = {
	'GET /preferences/:customerId/users': 'PreferencesController.index',
	'GET /preferences/:customerId/users/:userId': 'PreferencesController.index',
	'POST /preferences/:customerId/users/:userId': 'PreferencesController.update',
	//'GET /preferences/:customerId/users/:userId/unsubscribe': 'PreferencesController.unsubscribeAll',

	'GET /preferences/:customerId/users/:userId/unsubscribe?list=listName': 'PreferencesController.unsubscribeAll',
	
	'GET /usage/bme/login': 'BmeUsageController.login',
	'POST /usage/bme/login': 'BmeUsageController.authenticate',
	'GET /usage/bme/billing': 'BmeUsageController.billingData',
	'GET /usage/bme': 'BmeUsageController.index',
	'GET /usage/bme/top_senders': 'BmeUsageController.topSenders',
	'GET /usage/bme/top_subscribers': 'BmeUsageController.topSubscribers',
	'GET /forbes/login': 'ForbesReportsController.login',
	'POST /forbes/login': 'ForbesReportsController.authenticate',
	'GET /forbes/reports/email_content': 'ForbesReportsController.emailContentReport',
	'GET /forbes/reports/subscribers': 'ForbesReportsController.subscribersReport',
	'GET /forbes/reports/onsite': 'ForbesReportsController.onsiteReport',
};