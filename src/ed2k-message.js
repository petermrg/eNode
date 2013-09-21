var util = require('util'),
	DynamicBuffer = require('./dynamic-buffer.js').DynamicBuffer,
	log = require('tinylogger');

var noAssert = false;

// Protocol codes
var PR = {
	ED2K: 0xe3,
	EMULE: 0xc5,
	ZLIB: 0xd4
}

// Tag types
var TYPE = {
	HASH: 0x01,
	STRING: 0x02,
	UINT32: 0x03,
	FLOAT: 0x04,
	//BOOL: 0x05,
	//BOOLARR: 0x06,
	//BLOB: 0x07,
	UINT16: 0x08,
	UINT8: 0x09,
	//BSOB: 0x0a,
	TAGS: 0x0f
}

// Tag codes
var TAG = {
	NAME: 0x01,
	SIZE: 0x02,
	TYPE: 0x03,
	FORMAT: 0x04,
	VERSION: 0x11,
	VERSION_2: 0x91, // used in UDP OP_SERVERDESCRES
	PORT: 0x0f,
	DESCRIPTION: 0x0b,
	DYN_IP: 0x85,
	SOURCES: 0x15,
	COMPLETE_SOURCES: 0x30,
	MULE_VERSION: 0xfb,
	FLAGS: 0x20,
	RATING: 0xF7,
	SIZE_HI: 0x3A,
	SERVER_NAME: 0x01,
	SERVER_DESC: 0x0b,
	MEDIA_ARTIST: 0xd0,
	MEDIA_ALBUM: 0xd1,
	MEDIA_TITLE: 0xd2,
	MEDIA_LENGTH: 0xd3,
	MEDIA_BITRATE: 0xd4,
	MEDIA_CODEC: 0xd5,
	SEARCH_TREE: 0x0e,
	EMULE_UDP_PORTS: 0xf9,
	EMULE_OPTIONS_1: 0xfa,
	EMULE_OPTIONS_2: 0xfe,
	AUXPORTSLIST: 0x93
}

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
 * Shifts a block of data from the start of the buffer and moves the rest to start
 *
 * @param {integer} length Size in bytes of the data to extract
 * @return {Buffer} Shifted data
 */
Ed2kMessage.prototype.shift = function(length) {
	var result = new Ed2kMessage(length);
	this._buffer.copy(result._buffer, 0, 0, length);
	this._buffer.copy(this._buffer, 0, length);
	this._position-= length;
	result.seek(length);
	return result;
}

/**
 * [readTag description]
 *
 * @return {[type]}
 */
Ed2kMessage.prototype.readTag = function() {
	var type = this.readUInt8(),
		tag = false,
		code = 0,
		length = 0;

	if (type & 0x80) {
		// Lugdunum extended tag
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
		length = this.readUInt16LE();
		if (length == 1) {
			// default ed2k tag
			code = this.readUInt8();
		} else {
			// emule tag
			log.warn('Unhandled tag. Length: '+length.toString(16));
			return false;
		}
	}

	switch (code) {
		case TAG.NAME:
			tag = ['name', this.readTagValue(type)];
			break;
		case TAG.SIZE:
			tag = ['size', this.readTagValue(type)];
			break;
		case TAG.SIZE_HI:
			tag = ['sizeHi', this.readTagValue(type)];
			break;
		case TAG.TYPE:
			tag = ['type', this.readTagValue(type)];
			break;
		case TAG.FORMAT:
			tag = ['format', this.readTagValue(type)];
			break;
		case TAG.VERSION:
			tag = ['version', this.readTagValue(type)];
			break;
		case TAG.PORT:
			tag = ['port2', this.readTagValue(type)];
			break;
		case TAG.SOURCES:
			tag = ['sources', this.readTagValue(type)];
			break;
		case TAG.MULE_VERSION:
			tag = ['muleVersion', this.readTagValue(type)];
			break;
		case TAG.FLAGS:
			tag = ['flags', this.readTagValue(type)];
			break;
		case TAG.RATING:
			tag = ['rating', this.readTagValue(type)];
			break;
		case TAG.MEDIA_ARTIST:
			tag = ['artist', this.readTagValue(type)];
			break;
		case TAG.MEDIA_ALBUM:
			tag = ['album', this.readTagValue(type)];
			break;
		case TAG.MEDIA_TITLE:
			tag = ['title', this.readTagValue(type)];
			break;
		case TAG.MEDIA_LENGTH:
			tag = ['length', this.readTagValue(type)];
			break;
		case TAG.MEDIA_BITRATE:
			tag = ['bitrate', this.readTagValue(type)];
			break;
		case TAG.MEDIA_CODEC:
			tag = ['codec', this.readTagValue(type)];
			break;
		case TAG.SEARCH_TREE:
			tag = ['searchTree', this.readTagValue(type)];
			break;
		case TAG.EMULE_UDP_PORTS:
			tag = ['udpPorts', this.readTagValue(type)];
			break;
		case TAG.EMULE_OPTIONS_1:
			tag = ['options1', this.readTagValue(type)];
			break;
		case TAG.EMULE_OPTIONS_2:
			tag = ['options2', this.readTagValue(type)];
			break;
		default:
			tag = ['0x'+code.toString(16), this.readTagValue(type)];
	}
	return tag;
}

/**
 * [readTagValue description]
 *
 * @param	{[type]} type
 * @return {[type]}
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
			log.error('Unknown tag type: 0x'+type.toString(16));
	}
	return value;
}

/**
 * Read tags from buffer
 *
 * @return {Array} data
 */
Ed2kMessage.prototype.readTags = function() {
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
	}
	return tags;
}

/**
 * Reads string from buffer. If no length is specified, the length
 * is obtained from the first 16 bits (little endian)
 *
 * @param	{integer} length
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
 * @param	{[type]} str
 * @return {[type]}
 */
Ed2kMessage.prototype.writeString = function(str) {
	var length = Buffer.byteLength(str);
	this.writeUInt16LE(length);
	while (this.getSizeLeft() < length) {
		this.grow();
	}
	this._buffer.write(str, this._pointer, conf.noAssert);
	this._pointer+= length;
	return this;
}

/**
 * Serializes array data into binary form
 *
 * @param	{Array} data
 * @return {Ed2kMessage}
 */
Ed2kMessage.prototype.serialize = function(data) {
	var message = new Ed2kMessage();
	data.forEach(function(item) {
		switch (item[0]) {
			case TYPE_UINT8 : message.writeUInt8(item[1]); break;
			case TYPE_UINT16: message.writeUInt16LE(item[1]); break;
			case TYPE_UINT32: message.writeUInt32LE(item[1]); break;
			case TYPE_STRING: message.writeString(item[1]); break;
			case TYPE_HASH	: message.writeHash(item[1]); break;
			case TYPE_TAGS	: message.writeTags(item[1]); break;
		}
	});
	return message;
}

exports.Ed2kMessage = Ed2kMessage;
exports.PROTOCOLS = PR;