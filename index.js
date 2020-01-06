/**
 * @file index.js - main file to start script execution
 * @author Sumit Gupta <sumit.gupta@salesforce.com>
 */

'use strict';

//the helper object
var _ = require("./lib/helper");

var argv = process.argv || [];
var script = argv.splice(0, 3)[2];
var srcpath, username, password, loginurl, version, diffparam;

function execute(script){
	switch(script){
		case "delta": 
			_.log("\n> delta: removing unmodified files and folders..");
			return require(__dirname + "/api/delta").execute(diffparam);
		case "package": 
			_.log("\n> package: creating package.xml file..");
			return require(__dirname + "/api/package").execute();
		case "deployonly": 
			_.log("\n> deploy: initiating a deployment..");
			return require(__dirname + "/api/deploy")
			.execute(username, password, loginurl, version);
		case "status": 
			_.log("\n> status: showing deployment status..");
			return require(__dirname + "/api/status").execute();
		case "deploy": 
			return execute("delta")
			.then(_.partial(execute, "package"))
			.then(_.partial(execute, "deployonly"));
		default:
			return _.promise((resolve, reject) => {
				reject("Invalid script name");
			});
	}
}

_.each(argv, (str) => {
	var arr = str.split("=");
	if(arr.length == 2){
		var key = arr[0], value = arr[1];
		switch(key){
			case "srcpath": srcpath = value; break;
			case "username": username = value; break;
			case "password": password = value; break;
			case "serverurl": loginurl = value; break;
			case "version": version = value; break;
			case "diffparam": diffparam = value; break;
		}
	}
});

_.mixin({
	throwError: function(error){
		error = _.isError(error) ? error.message: error;
		_.log("\n");
		if(error !== "Deployment Failed"){
			_.log("There was an error. Please contact Anton or Sumit about this issue.\n");
		}
		Error.stackTraceLimit = 0;
		throw new Error(error);
	},
	done: function(failed){
		_.log("\n> Success: " + script + " done!!");
		process.exit(failed ? 1 : 0);
	}
});

// set global paths
global.sourcePath =  srcpath ? srcpath + "/" : __dirname + "/src/";
global.configPath = __dirname + "/config.json";
global.gitPath = global.sourcePath;
global.outputPath = __dirname + "/output/";

// run the script
execute(script)
.then(_.partial(_.delay, _.done, 1), _.partial(_.delay, _.throwError, 1))
.catch(_.partial(_.delay, _.throwError, 1));