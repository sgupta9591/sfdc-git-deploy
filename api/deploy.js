/**
 * @file deploy.js - deploy metadata to salesforce org using jsforce library
 * @author Sumit Gupta <sumit.gupta@salesforce.com>
 */

'use strict'; 

//the helper object
var _ = require("../lib/sal");

// global static variables
var SRC_PATH = global.sourcePath;
var GIT_PATH = global.gitPath;
var OUTPUT_PATH = global.outputPath;

// global public variables 
var logger = _.logger(); // logger object
var deployResult = {details:{componentFailures:[]}}; // deploy result object

// delete unwanted files
function clearSrc(path){
	return _.getFiles(path).then((files) => {
		var deletableFiles = [];
		_.each(files, (file) => {
			if(!file.includes("/src/") || file.endsWith(".DS_Store")){
				deletableFiles.push(file);
			}
		});
		if(deletableFiles.length){
			_.each(deletableFiles, _.loadModule("fs").unlinkSync);
		}
		_.loadModule("delete-empty").sync(path);
	});
}

function deploy(data){
	return _.deploy(data).then((result) => {
		logger.logln().log("Request for a deploy submitted successfully")
		.log("Request ID for the current deploy task: " + result.id)
		.log("Waiting for server to finish processing the request...");
		return result;
	});
}


//check deploy status
function checkDeployStatus(result){
	if(result.status){
		if(result.numberComponentsTotal){
			var msg = "total: " + result.numberComponentsTotal;
			msg += ", success: " + result.numberComponentsDeployed;
			msg += ", failure: " + result.numberComponentErrors;
			logger.logln().log("Request Status: " + result.status).log(msg);
		} else {
			logger.log("Request Status: " + result.status);
		}
	}
	var defer = _.deferred();
	if(!result.done){
		_.delay(() => {
			_.checkDeployStatus(result.id).then((result) => {
				return checkDeployStatus(result).then(defer.resolve);
			}, defer.reject);
		}, 20000);
	} else {
		deployResult = result;
		displayStatus();
		defer.resolve();
	}
	return defer.promise;
}

// get failed items
function getFailedItems(){
	var failures = [];
	if(deployResult.details) {
		_.each(_.ensureArray(deployResult.details.componentFailures), (failure) => {
			failures.push({
				name: failure.fullName,
				file: failure.fileName,
				error: failure.problem,
				type: failure.componentType
			});
		});
	} else if(deployResult.errorMessage){
		_.log("/n"+deployResult.errorMessage+"\n");
	}
	return failures;
}

// get committer details for all failed items
function getCommitterDetails(failures){ 
	var command = _.loadModule('command').open(GIT_PATH);
	var defers = [], files = {}, committers = {};
	_.each(failures, (failure) => {
		if(_.has(files, failure.file)){
			files[failure.file].push(failure);
		} else {
			files[failure.file] = [failure];
			defers.push(
				getCommitterName(command, "ChildStory/" + failure.file)
				.then((committer) => { committers[failure.file] = committer; })
			);
		}
	});
	return _.modules.Promise.all(defers).then(() => {
		_.each(committers, (committer, file) => {
			if(_.has(files, file)){
				_.each(files[file], (failure) => {
					failure.committer = committer;
				});
			}
		});
		return failures;
	});
}

//get git file last committer name
function getCommitterName(command, path){
	var defer = _.deferred();
	command.exec("git", ["log","-n","1","--pretty=format:%aN","--",path])
	.then(function (){
		defer.resolve(this.lastOutput.stdout);
	});
	return defer.promise;
}

function displayStatus(){
	if(deployResult.id){
		var msg = "*********** DEPLOYMENT STATUS ***********";
		logger.logln().log(msg)
		.log("Request ID: " + deployResult.id)
		.log("Result: " + deployResult.status)
		.log("Total Components: " + deployResult.numberComponentsTotal)
		.log("Components Deployed: " + deployResult.numberComponentsDeployed)
		.log("Component Errors: " + deployResult.numberComponentErrors)
		.log(msg);
	}
}

function writeResultFile(failures){
	var result = {
		id: deployResult.id,
		status: deployResult.status,
		total: deployResult.numberComponentsTotal,
		deployed: deployResult.numberComponentsDeployed,
		failed: deployResult.numberComponentErrors,
		failures: failures
	};
	return _.writeJsonFile(OUTPUT_PATH + "deploy_result.json", result);
}

// main function
function execute(username, password, loginurl, version){
	// login to salesforce
	return _.login({
		username: username || "username",
		password: password || "password",
		loginUrl: loginurl || "https://test.salesforce.com",
		version: version || "38.0"
	})
	// zip the src folder
	.then(_.partial(_.getZipData, SRC_PATH, OUTPUT_PATH))
	// deploy zip file to server
	.then(deploy).then(checkDeployStatus)
	// get git committer details
	.then(getFailedItems).then(getCommitterDetails)
	// write result file
	.then(writeResultFile);
}

module.exports.execute = execute;