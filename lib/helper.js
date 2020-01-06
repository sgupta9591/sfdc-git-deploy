/**
 * @file Provides underscore helper/utility object
 * @author Sumit Gupta <sumit.gupta@salesforce.com>
 */

'use strict';

var _ = module.exports = require('underscore');

_.modules = {};

_.mixin({
	// throw error
	error: function(message){ 
		throw new Error(message);
	},
	// log the message
	log: function(message){ 
		console.log(message);
	},
	// throw error if condition is false
	check: function(condition, message){ 
		if(!condition){
			_.error(message);
		}
	},
	// load and return the module
	loadModule: function(name, alias){
		_.check(_.isString(name), "loadModule: you must pass a string");
		if(!_.isString(alias)){
			alias = name;
		}
		if(!_.has(_, alias)){
			return _.modules[alias] = require(name);
		} else {
			return _.modules[alias];
		}
	},
	// load multiple modules
	loadModules: function(names){
		_.check(_.isArray(names), "loadModules: you must pass a array of string");
		_.each(names, _.loadModule);
	},
	// return promise object
	promise: function(callback){
		_.check(_.isFunction(callback), "promise: you must pass a function");
		var Promise = _.loadModule("promise/lib/es6-extensions", "Promise");
		return new Promise(callback);
	},
	// return deferred
	deferred: function(){
		var defer = {};
		defer.promise = _.promise((resolve, reject) => {
			defer.resolve = resolve;
			defer.reject = reject;
	  	});
	  	return defer;
	},
	// wrap nodejs style callback to promise
	denodeify: function(callback){
		var defer = _.deferred();
		var args = Array.prototype.slice.call(arguments, 1);
		args.push((error, result) => {
			if(error){ 
				defer.reject(error);
			} else {
				defer.resolve(result);
			}
		});
		callback.apply(callback, args);
		return defer.promise;
	},
	// get all file paths from a folder
	getFiles: function(path){
		_.check(_.isString(path), "getFiles: you must pass a string");
		return _.denodeify(_.loadModule("fs").readdir, path).then((files) => {
			if(_.isEmpty(files)){ return []; }
			var results = [], defers = [];
			_.each(files, (file) => { 
				file = path + file;
				defers.push(
					_.denodeify(_.modules.fs.stat, file).then((stat) => {
						if (stat.isDirectory()) { 
		                    return _.getFiles(file + "/").then((files) => {
		                    	results = _.union(results, files);
		                    });
		                } else if (stat.isFile()) {
		                	results.push(file);
		                }
					})
				);
			}); 
			return _.modules.Promise.all(defers).then(() => {
				return results;
			});
		});
	},
	// read all files from a folder
	readFiles: function(path, parse, type){
		_.check(_.isString(path), "readFiles: you must pass a string");
		return _.getFiles(path).then((files) => {
			if(_.isEmpty(files)){ return []; }
			if(parse){
				var defers = [];
				_.each(files, (file) => {
					if(!file.endsWith(".DS_Store")){
						defers.push(_.readFile(file, type));
					}
				}); 
				return _.modules.Promise.all(defers);
			} else {
				var results = [];
				var _path = _.loadModule("path")
				_.each(files, (file) => {
					results.push(_path.parse(file));
				}); 
				return results;
			}
		});
	},
	// read file
	readFile: function(path, type){
		_.check(_.isString(path), "readFile: you must pass a string");
		return _.denodeify(_.loadModule("fs").readFile, path).then((data) => { 
			var file = _.loadModule("path").parse(path);
			function done(data){
				file.data = data;
				return file;
			}
			if(type == "json" || file.ext == ".json"){
				return done(_.parseJson(data));
			} else if (type == "xml" || file.ext == ".xml"){
				return _.parseXml(data).then(done);
			} else {
				return done(data);
			}
		});
	},
	// write files to a folder
	writeFiles: function(params){
		var defer = _.deferred();
		var defers = [];
		_.each(params, (val, key) => {
			defers.push(_.writeFile(key, val));
		});
		_.modules.Promise.all(defers).then(defer.resolve, defer.reject);
		return defer;
	},
	// write file
	writeFile: function(path, data, rootName){
		var file = _.loadModule("path").parse(path);
		if(file.ext == ".json"){
			data = _.toJson(data.toString('utf8'));
		} else if (file.ext == ".xml"){
			data = _.toXml(data, rootName);
		}
		return _.denodeify(_.loadModule("fs").writeFile, path, data);
	},
	// write json file
	writeJsonFile: function(path, data){
		return _.denodeify(_.loadModule("fs").writeFile, path, _.toJson(data))
	},
	// convert json string to json object
	parseJson: function(data){
		return JSON.parse(data);
	},
	// convert xml string to json object
	parseXml: function(data){
		return _.denodeify(_.loadModule("xml2js").Parser({explicitArray: false}).parseString, data);
	},
	// convert json object to json string
	toJson: function(data){
		return JSON.stringify(data, null, "\t");
	},
	// convert json object to xml string
	toXml: function(data, rootName){
		return new (_.loadModule("xml2js").Builder)({rootName: rootName}).buildObject(data);
	},
	// get zip data
	getZipData: function(path, outputPath){
		return _.promise((resolve, reject) => {
			outputPath = outputPath + 'unpackaged.zip';
			var archive = _.loadModule('archiver')('zip');
			var output = _.loadModule('fs').createWriteStream(outputPath);
			output.on('close', () => {
				_.readFile(outputPath).then((file) => {
					resolve(file.data);
				}, reject);
			});
			archive.pipe(output);
			archive.on("error", reject)
			archive.directory(path, "unpackaged");
			archive.finalize();
		});
	},
	// return a logger object
	logger: function(total){
		var self = {
			log: (msg) => {
				_.log(msg); return self;
			},
			logln: () => {
				self.log(""); return self;
			},
			line: () => {
				self.log("-------------------------------"); return self;
			}
		};
		return self;
	},
	// return array
	ensureArray: function(list){
		if(list){
			if(_.isArray(list)){
				return list;
			}
			return [list];
		}
		return [];
	},
	parseFiles: function(files){
		_.check(_.isArray(files), "parsePaths: you must pass a array");
		var path = _.loadModule("path");
		var src = {};
		_.each(files, (file) => {
			var res = path.parse(file);
			var root = src;
			if(res.dir.length > 1){
				_.each(res.dir.split("/"), (folder) => {
					if(folder in root){
						root = root[folder];
					} else {
						root = root[folder] = {};
					}
				});
			}
			if(!root.files){
				root.files = [res.base];
			} else {
				root.files.push(res.base);
			}
		});
		return src;
	}
});