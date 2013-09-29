var log = require('tinylogger')

var noAssert = false,
	bufferSize = 1024,
	growFactor = 2;

/**
 * DynamicBuffer. It's a simple buffer wrapper.
 *
 * @param {integer} size Optional. Defaults to bufferSize.
 */
var DynamicBuffer = function (size) {
	this._position = 0
	this._buffer = new Buffer(size || bufferSize);
}

DynamicBuffer.prototype.tell = function(pos) {
	return this._position;
}

/**
 * Set read/write position
 *
 * @return {DynamicBuffer} self (chainable)
 */
DynamicBuffer.prototype.seek = function(pos) {
	this._position = pos;
	if (this._position > this._buffer.length) {
		throw new Error('trying to set position (' + pos + ') beyond buffer size (' + this._buffer.length + ')');
	}
	return this;
}

/**
 * Sets position to 0
 *
 * @return {DynamicBuffer} this
 */
DynamicBuffer.prototype.reset = function() {
	this._position = 0;
	return this;
}

/**
 * Set position to end
 *
 * @return {DynamicBuffer} this
 */
DynamicBuffer.prototype.end = function() {
	this._position = this._buffer.length;
	return this;
}

/**
 * Get current buffer size
 *
 * @return {integer} buffer size
 */
DynamicBuffer.prototype.getSize = function() {
	return this._buffer.length;
}

/**
 * Get free buffer size
 *
 * @return {integer} free buffer size
 */
DynamicBuffer.prototype.getSizeLeft = function() {
	return this._buffer.length - this._position;
}

/**
 * Increase buffer size
 *
 * @param {integer} factor New size = currentSize * factor.
 * @return {integer} new size
 */
DynamicBuffer.prototype.grow = function(factor) {
	factor = factor || growFactor;
	var newSize = Math.ceil(this._buffer.length * factor);
	var temp = new Buffer(newSize);
	this._buffer.copy(temp, 0, 0, this._position);
	this._buffer = temp;
	return this._buffer.length;
}

/**
 * Reads data and returns as buffer
 *
 * @param {Integer} length Number of bytes to read
 * @return {Buffer}
 */
DynamicBuffer.prototype.readBuffer = function(length) {
	var result = new Buffer(length);
	this._buffer.copy(result, 0, this._position, this._position + length);
	this._position+= length;
	return result;
}

/**
 * getBuffer
 *
 * @return {Buffer} instance of the DynamicBuffer contents
 */
DynamicBuffer.prototype.getBuffer = function() {
	return this._buffer.slice(0, this._position);
}

/**
 * Write buffer contents to DynamicBuffer
 *
 * @param {Buffer} buffer append
 */
DynamicBuffer.prototype.writeBuffer = function(buffer) {
	while (this.getSizeLeft() < buffer.length) {
		this.grow();
	}
	buffer.copy(this._buffer, this._position, 0, buffer.length);
	this._position+= buffer.length;
}

/**
 * Return buffer as string
 *
 * @param {string} encoding
 * @return {string} buffer contents, from 0 to current position
 */
DynamicBuffer.prototype.toString = function(encoding) {
	return this._buffer.toString(encoding, 0, this._position);
}

/**
 * Read an arbitrary number of bytes from buffer
 *
 * @param {integer} count
 * @return {array}
 * @todo tests
 */
DynamicBuffer.prototype.read = function(count) {
	var result,
		end,
		i = 0,
		j = 0;

	if (count === 0) {
		// read 0 bytes
		result = [];
	}
	else if (!count) {
		// read from current position to end
		result = [];
		for (i = this._position, j = 0; i < this._buffer.length; i++, j++) {
			result[j] = this._buffer[i];
		}
		this.end();
	} else {
		// read 'count' bytes
		result = [];
		for (i = this._position, j = 0; j < count; i++, j++) {
			result[j] = this._buffer[i];
		}
		this._position += count;
	}
	return result;
}

DynamicBuffer.prototype.readUInt8 = function() {
	var r = this._buffer.readUInt8(this._position, noAssert);
	this._position++;
	return r;
}

DynamicBuffer.prototype.writeUInt8 = function(n) {
	if (this.getSizeLeft() < 1) {
		this.grow();
	}
	this._buffer.writeUInt8(n, this._position, noAssert);
	this._position++;
	return this;
}

DynamicBuffer.prototype.readUInt16LE = function() {
	var r = this._buffer.readUInt16LE(this._position, noAssert);
	this._position+= 2;
	return r;
}

DynamicBuffer.prototype.writeUInt16LE = function(n) {
	if (this.getSizeLeft() < 2) {
		this.grow();
	}
	this._buffer.writeUInt16LE(n, this._position, noAssert);
	this._position+= 2;
	return this;
}

DynamicBuffer.prototype.readUInt32LE = function() {
	var r = this._buffer.readUInt32LE(this._position, noAssert);
	this._position+= 4;
	return r;
}

DynamicBuffer.prototype.writeUInt32LE = function(n) {
	if (this.getSizeLeft() < 4) {
		this.grow();
	}
	this._buffer.writeUInt32LE(n, this._position, noAssert);
	this._position+= 4;
	return this;
}

/*
DynamicBuffer.prototype.getUInt64LE = function() {
	var lo = this.readUInt32LE(this._position, noAssert)
	var hi = this.readUInt32LE(this._position+4, noAssert)
	this._position+= 8
	return lo + (hi * 0x100000000)
}


DynamicBuffer.prototype.putBuffer = function(buffer) {
	buffer.copy(this, this._position)
	this._position+= buffer.length
	if (this._position > this.length) { this._position = this.length	 }
	return this
}

DynamicBuffer.prototype.putHash = function(hash) {
	if ((hash instanceof Buffer) && (hash.length == 16)) {
		this.putBuffer(hash)
	}
	else {
		log.error('putHash: Unsupported input. Type: '+(typeof hash)+' Length: '+hash.length)
	}
	return this
}

DynamicBuffer.prototype.get = function(len) {
	if (len == 0) return
	if (len == undefined) {
		var r = this.slice(this._position, this.length)
		this._position = this.length
	}
	else {
		var end = this._position + len
		if (end > this.length) end = this.length
		var r = this.slice(this._position, end)
		this._position = end
	}
	r.seek(0)
	return r
}

// tags = array of array(type, code, data)

Buffer.tagsLength = function(tags) {
	var len = 4	 // tags count <u32>
	var tagsCount = tags.length
	for (var i=0; i<tagsCount; i++) {
		len+= 4	 // tag header (t[0] type <u8>).(length <u16>).(t[1] code<u8>)
		var t = tags[i]
		//log.trace(t)
		switch (t[0]) {
			case TYPE_STRING:
				len+= 2+Buffer.byteLength(t[2])
				break
			case TYPE_UINT8:
				len+= 1
				break
			case TYPE_UINT16:
				len+= 2
				break
			case TYPE_UINT32:
				len+= 4
				break
			default: log.error('Buffer.tagsLength: Unhandled tag type: 0x'+t[0].toString(16))
		}
	}
	return len
}

// tag = array(type, code, data)
DynamicBuffer.prototype.putTag = function(tag) {
	this.putUInt8(tag[0]).putUInt16LE(1).putUInt8(tag[1])	 // (type).(length=1).(code)
	switch (tag[0]) { // data
		case TYPE_STRING:
			this.putString(tag[2])
			break
		case TYPE_UINT8:
			this.putUInt8(tag[2])
			break
		case TYPE_UINT16:
			this.putUInt16LE(tag[2])
			break
		case TYPE_UINT32:
			this.putUInt32LE(tag[2])
			break
		default: log.error('Buffer.putTag: Unhandled tag type: 0x'+tag[0].toString(16))
	}
}

DynamicBuffer.prototype.putTags = function(tags) {
	var count = tags.length
	this.putUInt32LE(count)
	for (var i=0; i<count; i++) {
		this.putTag(tags[i])
	}
	return this
}

DynamicBuffer.prototype.getFileList = function(callback) {
	//log.debug('Buffer.getFileList')
	var count = this.getUInt32LE()
	for (var i=0; i<count; i++) {
		var file = {
			'hash': this.get(16),
			'complete': 1, // let's suppose it's completed by default
		}
		var id = this.getUInt32LE()
		var port = this.getUInt16LE()
		this.getTags(function(tag) {
			//log.trace(tag)
			file[tag[0]] = tag[1]
		})
		if ((id == VAL_PARTIAL_ID) && (port == VAL_PARTIAL_PORT)) {
			file.complete = 0
		}
		else if ((id == VAL_COMPLETE_ID) && (port == VAL_COMPLETE_PORT)) {
			file.complete = 1
		}
		file.sizeLo = file.size
		if (file.sizehi) {
			file.size+= file.sizehi * 0x100000000
		}
		else file.sizehi = 0
		if (callback) callback(file)
	}
	return count
}
*/
module.exports = DynamicBuffer;
