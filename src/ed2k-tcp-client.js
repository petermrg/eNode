var CS = {
	NEW: 0
}

/**
 * Client info
 *
 * @param {string} address Client address
 * @param {string} port Client port
 */
var Ed2kTcpClient = function(address, port) {
	this.status = CS.NEW;
	this.address = address;
	this.port = port;
}

Ed2kTcpClient.prototype.toString = function() {
	return JSON.stringify(this);
}

exports.Ed2kTcpClient = Ed2kTcpClient;
exports.CLIENT_STATUS = CS;

