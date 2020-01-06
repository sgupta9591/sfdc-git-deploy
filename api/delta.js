/**
 * @file delta.js - fetch delta using git diff command
 * @author Sumit Gupta <sumit.gupta@salesforce.com>
 */

'use strict';

// the helper object
var _ = require("../lib/helper"); 

// global static variables
var SRC_PATH = global.sourcePath;
var META_EXTS = [".cmp", ".evt", ".app", ".cls", ".component", ".email", ".page", ".resource", ".trigger"];

// compare history with latest and delete unmodified files
function compareAndRemoveFiles(history){
	return _.getFiles(SRC_PATH).then((results) => {
		var files = [], removableFiles = [];
		_.each(results, (file) => {
			files.push(file.replace(SRC_PATH, ""));
		});
		// get deletable files
		getRemovableFiles(_.parseFiles(files), history, SRC_PATH.substring(0, SRC_PATH.length - 1), removableFiles);
		// delete files
		_.each(removableFiles, _.loadModule("fs").unlinkSync);
		// delete empty folders
		_.loadModule("delete-empty").sync(SRC_PATH, {verbose:  false});
	});
}

// get deletable files
function getRemovableFiles(latest, history, path, results){
	for(var key in latest){
		var val1 = latest[key], val2 = history[key];
		// when file is modified
		if(val1 && val2){
			if(key === "files"){
				if(!path.includes("/aura/")){
					_.each(_.difference(val1, val2), (_path) => {
						results.push(path + "/" + _path);
					});
				}
			} else {
				getRemovableFiles(val1, val2, path + "/" + key, results);
			}
		// when file is not modified
		} else if(val1){
			if(key === "files"){
				_.each(val1, (_path) => {
					results.push(path + "/" + _path);
				});
			} else {
				getRemovableFiles(val1, {}, path + "/" + key, results);
			}
		}
	}
}

// get git differences
function getGitDiff(diffparam){
	var defer = _.deferred();
	_.loadModule('command').open(SRC_PATH)
	.exec("git", ["diff", diffparam, "--name-status"])
	.then(function (){
		var results = [], path = _.loadModule("path");
	    var lines = this.lastOutput.stdout.split("\n");
	    _.each(lines, (line) => {
	    	var arr = line.split("\t");
	    	var type = arr[0];
	    	// added or modified files considered as change
	    	if(type == "A" || type == "M"){
	    		var _path = arr[1];
	    		// check if meta file is required
	    		if(_.contains(META_EXTS, path.parse(_path).ext)){
	    			var metaPath = _path + '-meta.xml';
	    			if(!_.contains(results, metaPath)){
	    				results.push(metaPath);
	    			}
	    		}
	    		if(!_.contains(results, _path)){
	    			results.push(_path);
	    			// check if original file is required
	    			if(_path.endsWith("-meta.xml")){
	    				_path = _path.replace("-meta.xml", "");
	    				if(!_.contains(results, _path)){
	    					results.push(_path);
	    				}
	    			}
	    		}
	    	}
	    });
	    results = _.parseFiles(results);
		if(!results.ChildStory){
			results.ChildStory = {src: {}};
		}
		defer.resolve(results.ChildStory.src);
	}, defer.reject);
	return defer.promise;
}

function execute(diffparam){
	if(!diffparam){
		return _.promise((resolve, reject) => {
			reject("You need to pass first parameter for git diff command");
		});
	}
	// get git differences
	return getGitDiff(diffparam)
	// compare and delete unmodified files
	.then(compareAndRemoveFiles);
}

module.exports.execute = execute;
