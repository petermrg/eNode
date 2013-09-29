require('./ed2k-globals.js');

var util = require('util'),
	helpers = require('./helpers.js');

/**
 * Client info
 *
 * @param {string} IPv4 address Client address. In string (a.b.c.d) or Int23LE.
 * @param {string} port Client port
 */
var Ed2kClient = function(id, port) {
	this.id = id || null; // int32
	this.hash = null; // Buffer(16);
	this.status = CS.NOT_CONNECTED;
	this.port = port || null; // int16
	this.name = null; // string
	this.version = null;
	this.muleVersion = null;
	this.flags = null;
	this.time = new Date(); // connection time
}

Ed2kClient.prototype.toString = function() {
	return [helpers.Int32LEtoIp4(this.id), ':', this.port].join('');
}

module.exports = Ed2kClient;

