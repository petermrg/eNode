/**
 * Skeleton for buiding new storage engines
 */

var log = require('tinylogger')
var misc = require('../ed2k/misc.js')
var conf = require('../enode.config.js').config.storage.dummy

exports.init = function(callback) {
  log.info('Dummy Engine init')
  callback();
}

exports.clients = {
  _count: 0,
  count: function() { return clients._count; },
  isConnected: function(clientInfo, callback) {},
  connect: function(clientInfo, callback) {},
  disconnect: function(clientInfo) {},
}

exports.files = {
  _count: 0,
  count: function() { return files._count; },
  add: function(file, clientInfo) {},
  getSources: function(fileHash, fileSize, clientInfo, callback) {},
  getSourcesByHash: function(fileHash, callback) {},
  find: function(data, callback) {},
}

exports.servers = {
  _count: 0,
  count: function() { return servers._count; },
  add: function() {},
  all: function() {},
}
