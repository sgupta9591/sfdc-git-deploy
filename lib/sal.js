/**
 * @file Salesforce Access Layer: Utility
 * @author Sumit Gupta <sumit.gupta@salesforce.com>
 */

'use strict';

//the helper object
var _ = module.exports = require('./helper'); 
var jsforce = _.loadModule("jsforce");
var conn = new jsforce.Connection();
var version = "34.0";

_.mixin({
	// login to salesforce
	login: function(params){
		_.check(_.isObject(params) && _.isString(params.username) && 
			_.isString(params.password) && _.isString(params.loginUrl), "login: invalid parameter value");
		version = params.version || version;
		conn = new jsforce.Connection(params);
		return conn.login(params.username, params.password);
	},
	// deploy components
	deploy: function(data) {
		return conn.metadata.deploy(data, {
			checkOnly: true, ignoreWarnings: true,
			testLevel: "NoTestRun", runAllTests: false, 
			rollbackOnError: true, performRetrieve: false,
			purgeOnDelete: true
		});
	},
	// check deploy status
	checkDeployStatus: function(deployId){
		return conn.metadata.checkDeployStatus(deployId, true);
	}
});