require('./ed2k-globals.js');

var util = require('util'),
	DynamicBuffer = require('./dynamic-buffer.js'),
	hexDump = require('hexy').hexy,
	log = require('tinylogger');

var noAssert = false;



/**
 * DynamicBuffer extension to handle ed2k messages
 */
var Ed2kMessage = function(size) {
	DynamicBuffer.call(this, size);
}

util.inherits(Ed2kMessage, DynamicBuffer);

/**
 * Determines if a protocol code is valid
 *
 * @param {integer} protocol number
 * @return {boolean} true if valid
 */
Ed2kMessage.validProtocol = function(protocol) {
	return protocol == PR.ED2K || protocol == PR.EMULE || protocol == PR.ZLIB;
}

/**
 * Read message opcode. Sets position to the start of the data.
 *
 * @return {integer} message opcode
 */
Ed2kMessage.prototype.readOpcode = function() {
	this.seek(5);
	return this.readUInt8();
}

/**
 * Shifts a message from the start of the buffer and moves the remaining data to start
 *
 * @param {integer} length Size in bytes of the data to extract
 * @return {Ed2kMessage} Shifted message
 */
Ed2kMessage.prototype.shift = function(length) {
	//log.trace('Ed2kMessage.shift');
	var message = new Ed2kMessage(length);
	this._buffer.copy(message._buffer, 0, 0, length);
	this._buffer.copy(this._buffer, 0, length);
	this._position-= length;
	message.seek(length);
	return message;
}

/**
 * Read a tag from message. Tag structure: [type(UInt8), codeLength(UInt16), code(UInt8), data]
 *
 * @return {Array} Array [tagCode, value]
 */
Ed2kMessage.prototype.readTag = function() {
	var type = this.readUInt8(),
		tag = false,
		code = 0,
		length = 0;

	if (type & 0x80) {
		// Lugdunum extended tag - highest bit of 'type' is set
		code = this.readUInt8();
		type = (type & 0x7f);
		if (type >= 0x10) {
			length = type - 0x10;
			type = TYPE.STRING;
			this.seek(this.tell() - 2);
			this.writeUInt16LE(length);
			this.seek(this.tell() - 2);
		}
	} else {
		// Regular ed2k tag with given 'code' and 'type'
		codeLength = this.readUInt16LE();
		if (codeLength == 1) {
			// default ed2k tag (code is a byte)
			code = this.readUInt8();
		} else {
			// emule tag (code is a string?)
			//code = this.readString(codelength);
			log.warn('Unhandled tag. codeLength: ' + codeLength.toString(16));
			throw Error('Unhandled tag. codeLength: ' + codeLength.toString(16));
		}
	}

	return [TAG_INVERSE[code] || ('0x' + code.toString(16)), this.readTagValue(type)];
}

/**
 * Read tag value from message
 *
 * @param {Integer} type
 * @return {Integer|String} Tag value
 */
Ed2kMessage.prototype.readTagValue = function(type) {
	switch (type) {
		case TYPE.STRING:
			value = this.readString();
			break;
		case TYPE.UINT8:
			value = this.readUInt8();
			break;
		case TYPE.UINT16:
			value = this.readUInt16LE();
			break;
		case TYPE.UINT32:
			value = this.readUInt32LE();
			break;
		default:
			value = false;
			log.error('Unknown tag type: 0x' + type.toString(16));
	}
	return value;
}

/**
 * Read tags from buffer
 *
 * @param {Function} callback(tag) Optional callback to execute for each tag.
 * @return {Array} data
 */
Ed2kMessage.prototype.readTags = function(callback) {
	var count = this.readUInt32LE(),
		tags = {},
		tag = [];

	while (count--) {
		tag = this.readTag();
		if (tag === false) {
			log.error('readTags');
			tags = { 'error': true };
			break;
		}
		tags[tag[0]] = tag[1];
		if (callback) callback(tag);
	}
	return tags;
}

/**
 * Write a single tag to message
 *
 * @param  {Array} tag Structure: Array [type, code, data]
 */
Ed2kMessage.prototype.writeTag = function(tag) {
	//log.trace('Ed2kMessage.writeTag: ' + JSON.stringify(tag));
	this.writeUInt8(tag[0]).writeUInt16LE(1).writeUInt8(tag[1])	 // (type).(length=1).(code)
	switch (tag[0]) {
		case TYPE.STRING:
			this.writeString(tag[2])
			break
		case TYPE.UINT8:
			this.writeUInt8(tag[2])
			break
		case TYPE.UINT16:
			this.writeUInt16LE(tag[2])
			break
		case TYPE.UINT32:
			this.writeUInt32LE(tag[2])
			break
		default: log.error('Buffer.writeTag: Unhandled tag type: 0x'+tag[0].toString(16))
	}
}

/**
 * Write tags to message
 *
 * @param {Array} tags
 * @return {Ed2kMessage} self
 */
Ed2kMessage.prototype.writeTags = function(tags) {
	// log.trace('Ed2kMessage.writeTags: ');
	// console.log(tags);
	var count = tags.length;
	this.writeUInt32LE(count);
	for (var i = 0; i < count; i++) {
		this.writeTag(tags[i]);
	}
	return this;
}

/**
 * Reads string from buffer. If no length is specified, the length
 * is obtained from the first 16 bits (little endian)
 *
 * @param {integer} length
 * @return {string}
 * @todo {test}
 */
Ed2kMessage.prototype.readString = function(length) {
	if (arguments.length == 0) {
		length = this.readUInt16LE();
	}
	return (new Buffer(this.read(length))).toString();
}

/**
 * Write string to buffer
 *
 * @param {String} str
 * @return {Ed2kMessage} self
 */
Ed2kMessage.prototype.writeString = function(str, encoding) {
	var length = Buffer.byteLength(str, encoding);
	this.writeUInt16LE(length);
	while (this.getSizeLeft() < length) {
		this.grow();
	}
	var bytesWritten = this._buffer.write(str, this._position, encoding);
	this._position+= bytesWritten;
	return this;
}

/**
 * Write a message to the message (append)
 *
 * @param {Ed2kMessage} message
 * @return {Ed2kMessage} self
 */
Ed2kMessage.prototype.writeMessage = function(message) {
	this.writeBuffer(message.getBuffer());
	return this;
}

/**
 * Read a hash from the message
 *
 * @param {Buffer} hash
 * @return {Ed2kMessage} self
 */
Ed2kMessage.prototype.writeHash = function(hash) {
	this.writeBuffer(hash);
	return this;
}

/**
 * Read a hash from the message
 *
 * @return {Buffer}
 */
Ed2kMessage.prototype.readHash = function() {
	return this.readBuffer(16);
}

/**
 * Serializes array data into binary form
 *
 * @param {Array} data Structure: Array[Array[type, value]]
 * @return {Ed2kMessage}
 */
Ed2kMessage.serialize = function(data) {
	var message = new Ed2kMessage(),
		count = data.length,
		size = 0;

  	message.seek(5);
	for (var i = 0; i < count; i++) {
		switch (data[i][0]) {
			case TYPE.UINT8:
				message.writeUInt8(data[i][1]);
				break;
			case TYPE.UINT16:
				message.writeUInt16LE(data[i][1]);
				break;
			case TYPE.UINT32:
				message.writeUInt32LE(data[i][1]);
				break;
			case TYPE.STRING:
				message.writeString(data[i][1]);
				break;
			case TYPE.HASH:
				message.writeHash(data[i][1]);
				break;
			case TYPE.TAGS:
				message.writeTags(data[i][1]);
				break;
			default:
				log.error('Ed2kMessage.serialize: unhandled tag code: 0x' + data[i][0].toString(16));
		}
	}

	// write the header
	size = message.tell();
	message
		.reset()
		.writeUInt8(PR.ED2K)
		.writeUInt32LE(size - 5)
		.seek(size);
	return message;
}

module.exports = Ed2kMessage;