var util = require('util'),
	Ed2kMessage = require('./ed2k-message.js').Ed2kMessage,
	log = require('tinylogger');

var CS = {
	NEW: 0
}

/**
 * TCP data stream
 */
var Ed2kTcpStream = function() {
	Ed2kMessage.call(this);
};

util.inherits(Ed2kTcpStream, Ed2kMessage);

/**
 * Append data to stream
 *
 * @param {integer} clientStatus
 * @param {Buffer} data
 * @return {Ed2kTcpStream} self
 */
Ed2kTcpStream.prototype.append = function (clientStatus, data) {
	this.writeBuffer(data);
	return this;
};

/**
 * Parse the stream and extract all completed messages
 *
 * @return {Array} Array of Ed2kMessages
 */
Ed2kTcpStream.prototype.parse = function(callback) {
	var result = [],
		message,
		protocol,
		messageSize,
		dataSize,
		bufferSize = this.tell(),
		headerSize = 5; // protocol (8 bits) + size (32 bits) = 5 bytes

	while (bufferSize >= headerSize) {

		this.reset();
		protocol = this.readUInt8();

		if (Ed2kMessage.validProtocol(protocol)) {

			dataSize = this.readUInt32LE();
			messageSize = dataSize + headerSize;

			if (messageSize <= bufferSize) {
				// restore buffer position
				this.seek(bufferSize);
				message = this.shift(messageSize);
				bufferSize-= messageSize;
				result.push(message);
			} else {
				// restore buffer position
				this.seek(bufferSize);
				// break while
				bufferSize = 0;
			}

		} else {
			// Bad protocol number. Discard all data
			// log.warn('Ed2kMessage.parseEd2kPMessage: bad protocol: 0x' + protocol.toString(16));
			this.reset();
			bufferSize = 0;
		}
	}
	return result;
}


exports.Ed2kTcpStream = Ed2kTcpStream;
exports.CLIENT_STATUS = CS;


/*
message.prototype.init = function(buffer) {
	//log.trace('message.init: buffer.length: '+buffer.length);
	this.hasExcess = false;
	this.protocol = buffer.getUInt8();
	if ((this.protocol == PR_ED2K) || (this.protocol == PR_ZLIB) || (this.protocol == PR_EMULE)) {
		this.size = buffer.getUInt32LE()-1;
		this.code = buffer.getUInt8();
		// log.trace('message init: protocol: 0x'+this.protocol.toString(16)+
		//	 ' data size (header): '+this.size+' opcode: 0x'+this.code.toString(16));
		//TODO do checkings here
		this.data = new Buffer(this.size);
		this.append(buffer.get());
	}
	else {
		if (this.client.crypt && ((this.client.crypt.status == CS_UNKNOWN) ||
			(this.client.crypt.status == CS_NEGOTIATING))) {
			this.client.crypt.process(buffer);
		}
		else {
			log.warn('message.init: unknown protocol: 0x'+this.protocol.toString(16));
			//console.log(hexDump(buffer));
		}
	}
	//return this;
};
*/