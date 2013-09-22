global.CS = {
	NOT_LOGGED: 0,
	CONNECTION_CLOSE: 1,
}

/**
 * Client info
 *
 * @param {string} address Client address
 * @param {string} port Client port
 */
var Ed2kClient = function(address, port) {
	this.id = 1;
	this.status = CS.NOT_LOGGED;
	this.address = address;
	this.port = port;
}

Ed2kClient.prototype.toString = function() {
	return [this.address,':',this.port].join('');
}

exports.Ed2kClient = Ed2kClient;
exports.CLIENT_STATUS = CS;

