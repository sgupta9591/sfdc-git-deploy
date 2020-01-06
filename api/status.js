/**
 * @file status.js - log deployment status to console
 * @author Sumit Gupta <sumit.gupta@salesforce.com>
 */

'use strict'; 

//the helper object
var _ = require("../lib/helper");

// global static variables
var OUTPUT_PATH = global.outputPath || __dirname + "/"; 

//global public variables
var logger = _.logger(); // logger object
var result = {}; // result object

// write status to console
function writeOutput(success){ 
	if(success) return success;
	logger.logln().log("All Component Failures: ").line();
	var count = 1;
	function File(name, committer){
		var types = {};
		return {
			addError: (error) => {
				if(!_.has(types, error.type)){
					types[error.type] = Type(error.type);
				}
				types[error.type].addError(error);
			},
			print: () => {
				logger.logln().log("File: " + name)
				.log("Last committed by: " + committer || "Unknown").log("Errors:");
				_.invoke(types, 'print');
			}
		}
	}
	function Type(name){
		var errors = [];
		return {
			addError: (error) => {
				errors.push(error);
			},
			print: () => {
				logger.log("  " + name + ":");
				_.each(errors, (item) => {
					logger.log("    " + (count++) + ". " + item.name + ": " + item.error);
				});
			}
		}
	}
	var exts = {}, files = {};
	_.each(result.failures, (item) => {
		var file = files[item.file];
		if(!file){
			file = files[item.file] = File(item.file, item.committer);
		}
		file.addError(item);
		var key = item.file.split(".")[1];
		var ext = exts[key];
		if(!ext){
			ext = exts[key] = {};
		}
		ext[item.file] = file;
	});
	_.each(exts, (ext) => {
		_.invoke(ext, 'print');
	});
	return success;
}

function displayStatus(){
	if(result.id){
		var msg = "*********** DEPLOYMENT STATUS ***********";
		logger.logln().log(msg)
		.log("Request ID: " + result.id)
		.log("Result: " + result.status)
		.log("Total Components: " + result.total)
		.log("Components Deployed: " + result.deployed)
		.log("Component Errors: " + result.failed)
		.log(msg);
	}
	return (result.status === "Succeeded");
}

//main function
function execute(){
	return _.readFile(OUTPUT_PATH + "deploy_result.json")
	.then(
		(file) => { result = file.data; }, 
		(error) => { throw new Error("No deployment status available yet"); }
	)
	.then(displayStatus)
	.then(writeOutput)
	.then((success) => {
		return _.promise((resolve, reject) => { 
			(success || displayStatus()) ? resolve() : reject("Deployment Failed");
		})
	});
}

module.exports.execute = execute;