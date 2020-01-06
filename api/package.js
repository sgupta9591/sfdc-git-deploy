/**
 * @file package.js generate package.xml file for metadata deployment
 * @author Sumit Gupta <sumit.gupta@salesforce.com>
 */

'use strict';

// the helper object
var _ = require("../lib/helper"); 

// global static variables
var SRC_PATH = global.sourcePath || __dirname + "/";
var CONFIG_PATH = global.configPath || __dirname + "/config.json";

// global public variables
var config = {}; // config object

// wrapper class for package
function Package(){
	var self = this;
	self.version = 38.0;
	self.types = [];
	
	// private methods
	var getTypeName = (ext) => {
		if(_.has(config.types, ext)){
			return config.types[ext].name || "";
		}
		return "";
	};
	
	var getType = (name) => {
		return _.find(self.types, (type) => { 
			return type.getName() === name; 
		});
	};
	
	var addType = (name, ext) => {
		var type = new Type(name, ext);
		self.types.push(type);
		return type;
	};
	
	return {
		// public methods
		addMember: (name, ext) => {
			ext = ext.replace(".", "");
			var tname = getTypeName(ext);
			if(tname){
				var type = getType(tname);
				if(!type){
					type = addType(tname, ext);
				}
				type.addMember(name);
			}
		},
		getData: () => {
			var types = [];
			for(var i = 0; i < self.types.length; i++){
				types.push(self.types[i].getData());
			}
			self.types = types;
			self.version = config.version || self.version;
			return self;
		}
	}
}

//wrapper class for type
function Type(name, ext){
	var self = this;
	self.name = name;
	self.members = [];
	
	// private methods
	var isAllowWildCard = () => {
		if(_.has(config.types, ext)){
			return config.types[ext].wildCard || false;
		}
		return false;
	};
	
	return {
		// public methods
		getName: () => {
			return name;
		},
		addMember: (member) => {
			if(isAllowWildCard()){
				self.members[0] = "*";
			} else {
				self.members.push(member);
			}
		},
		getData: () => {
			return self;
		}
	}
}

// get type config
function getType(name) {
	return _.find(self.types, (type) => { 
		return type.getName() === name; 
	});
};

// check for meta file
function isMetaFile(name){
	return name.endsWith("-meta.xml");
}

// write package.xml file
function writePackageFile(packge){
	var data = packge.getData();
	_.log("\n----------Start of package.xml----------\n");
	_.log(_.toXml(data, "Package"));
	_.log("\n----------End of package.xml----------");
	return _.writeFile(SRC_PATH + 'package.xml', data, "Package");
}

//add custom objects as package members
function addChildMembers(packge, validFiles, type){
	var validFileNames = _.pluck(validFiles, 'name');
	var path = validFiles[0].dir + "/";
	return _.readFiles(path, true, "xml").then((files) => {  
		_.each(files, (file) => {
			if(!_.contains(validFileNames, file.name)){
				return;
			}
			var data = file.data[type];
			if(type !== "CustomObject" || data.deploymentStatus || data.label){ 
				packge.addMember(file.name, file.ext);
			}
			_.each(data, (val, key) => {
				if(_.has(config.types, key)){ 
					var type = config.types[key];
					if(type.unique){
						if(!_.isArray(val)){
							val = [val];
						}
						_.each(val, (item) => { 
							if(_.has(item, type.unique)){ 
								packge.addMember(file.name + '.' + item[type.unique], key);
							}
						});
					}
				}
			});
		});
	});
}

//add custom labels as package members
function addCustomLabelMembers(packge, file){
	return _.readFile(file.dir + '/' + file.base, "xml").then((file) => {
		_.each(file.data.CustomLabels.labels, (label) => {
			packge.addMember(label.fullName, ".labels");
		});
	});
}

// add members to package wrapper object
function addMembers(packge, files){ 
	// to store custom labels file
	var labelsFile = null;
	// to store custom labels file
	var objectFiles = [];
	// to store workflow files
	var workflowFiles = [];
	// to store matching rules
	var matchingRuleFiles = [];
	// to store sharing rules
	var sharingRuleFiles = [];
	// add files as package members
	_.each(files, (file, ind) => {
		// ignore meta files
		if(!isMetaFile(file.base)){
			if(file.ext === ".labels"){
				labelsFile = file;
			} else if(file.ext === ".object"){
				objectFiles.push(file);
			} else if(file.dir.indexOf("/documents") >= 0){
				file.name = file.dir.split("/documents/")[1] + "/" + file.base;
				packge.addMember(file.name, "document");
			} else if(file.dir.indexOf("/email/") >= 0){
				file.name = file.dir.split("/email/")[1] + "/" + file.name;
				packge.addMember(file.name, "email");
			} else if(file.dir.indexOf("/reports/") >= 0){
				file.name = file.dir.split("/reports/")[1] + "/" + file.name;
				packge.addMember(file.name, "report");
			} else if(file.ext === ".app" && file.dir.includes("/aura/")) {
				packge.addMember(file.name, ".auraApp");
			} else if(file.ext === ".workflow"){
				workflowFiles.push(file);
			} else if(file.ext === ".matchingRule"){
				matchingRuleFiles.push(file);
			} else if(file.ext === ".sharingRules"){
				sharingRuleFiles.push(file);
				packge.addMember(file.name, file.ext);
			} else {
				packge.addMember(file.name, file.ext);
			}
		} else if(file.dir.endsWith("/documents")){
			file.name = file.name.replace("-meta", "");
			packge.addMember(file.name, "document");
		} else if(file.dir.endsWith("/email")){
			file.name = file.name.replace("-meta", "");
			packge.addMember(file.name, "email");
		} else if(file.dir.endsWith("/reports")){
			file.name = file.name.replace("-meta", "");
			packge.addMember(file.name, "report");
		}
	}); 
	var defers = [];
	if(labelsFile){
		defers.push(addCustomLabelMembers(packge, labelsFile));
	}
	if(objectFiles.length){
		defers.push(addChildMembers(packge, objectFiles, "CustomObject"));
	}
	if(workflowFiles.length){
		defers.push(addChildMembers(packge, workflowFiles, "Workflow"));
	}
	if(matchingRuleFiles.length){
		defers.push(addChildMembers(packge, matchingRuleFiles, "MatchingRules"));
	}
	if(sharingRuleFiles.length){
		defers.push(addChildMembers(packge, sharingRuleFiles, "SharingRules"));
	}
	return _.modules.Promise.all(defers);
}

// main function
function execute(){ 
	// create package wrapper object
	var packge = new Package();
	// read configuration file
	return _.readFile(CONFIG_PATH)
	// set config object
	.then((file) => {config = file.data;})
	// read all files from src folder
	.then(_.partial(_.readFiles, SRC_PATH))
	// add members to package wrapper object
	.then(_.partial(addMembers, packge))
	// write package wrapper object as package.xml
	.then(_.partial(writePackageFile, packge));
}

module.exports.execute = execute;