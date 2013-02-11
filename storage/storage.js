
var conf = require('../enode.config.js').config;
var engine = require('./engine.'+conf.storage.engine+'.js');

exports.init = function(callback) { return engine.init(callback); };

exports.clients = {
    count: function() { return engine.clients.count; },
    isConnected: function(clientInfo, callback) { return engine.clients.isConnected(clientInfo, callback); },
    connect: function(clientInfo, callback) { return engine.clients.connect(clientInfo, callback); },
    disconnect: function(clientInfo) { return engine.clients.disconnect(clientInfo); },
};

exports.files = {
    count: function() { return engine.files.count; },
    add: function(file, clientInfo) { return engine.files.add(file, clientInfo); },
    getSources: function(fileHash, fileSize, clientInfo, callback) { return engine.files.getSources(fileHash, fileSize, clientInfo, callback); },
    getSourcesByHash: function(fileHash, callback) { return engine.files.getSourcesByHash(fileHash, callback); },
    find: function(data, callback) { return engine.files.find(data, callback); },
};

exports.servers = {
    count: function() { return engine.servers.count; },
    add: function() { log.todo('storage.servers.add'); },
    all: function() { return engine.servers.all(); },
};
