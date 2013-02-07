GLOBAL.PS_NEW              = 0x01;
GLOBAL.PS_READY            = 0x02;
GLOBAL.PS_WAITING_DATA     = 0x03;

require('./buffer.js');
var log = require('tinylogger');

var Packet = function() {
    this.protocol = 0;
    this.size = 0;
    this.code = 0;
    this.status = PS_NEW;
    this.data = new Buffer(0);
};
Packet.cache = {};

// TODO: handle multipart packets sends
// TODO: gzip compression on sending
// TODO: Rewrite this using a stream pipe into array or something and then create buffer
Packet.make = function(protocol, items) {
    var size = 0;
    items.forEach(function(v){
        switch (v[0]) {
            case TYPE_UINT8 : size+= 1; break;
            case TYPE_UINT16: size+= 2; break;
            case TYPE_UINT32: size+= 4; break;
            case TYPE_STRING: size+= 2 + Buffer.byteLength(v[1]); break;
            case TYPE_HASH  : size+= 16; break;
            case TYPE_TAGS  : size+= Buffer.tagsLength(v[1]); break;
        }
    });
    var buf = new Buffer(5 + size);
    buf.putUInt8(protocol);
    buf.putUInt32LE(size);
    items.forEach(function(v){
        //log.trace(v);
        switch (v[0]) {
            case TYPE_UINT8 : buf.putUInt8(v[1]); break;
            case TYPE_UINT16: buf.putUInt16LE(v[1]); break;
            case TYPE_UINT32: buf.putUInt32LE(v[1]); break;
            case TYPE_STRING: buf.putString(v[1]); break;
            case TYPE_HASH  : buf.putHash(v[1]); break;
            case TYPE_TAGS  : buf.putTags(v[1]); break;
        }
    });
    return buf.pos(0);
};

//TODO: rewrite this...
//The same as TCP but without the size
Packet.makeUDP = function(protocol, items) {
    var size = 0;
    items.forEach(function(v){
        switch (v[0]) {
            case TYPE_UINT8 : size+= 1; break;
            case TYPE_UINT16: size+= 2; break;
            case TYPE_UINT32: size+= 4; break;
            case TYPE_STRING: size+= 2 + Buffer.byteLength(v[1]); break;
            case TYPE_HASH  : size+= 16; break;
            case TYPE_TAGS  : size+= Buffer.tagsLength(v[1]); break;
        }
    });
    var buf = new Buffer(1 + size);
    buf.putUInt8(protocol);
    items.forEach(function(v){
        //log.trace(v);
        switch (v[0]) {
            case TYPE_UINT8 : buf.putUInt8(v[1]); break;
            case TYPE_UINT16: buf.putUInt16LE(v[1]); break;
            case TYPE_UINT32: buf.putUInt32LE(v[1]); break;
            case TYPE_STRING: buf.putString(v[1]); break;
            case TYPE_HASH  : buf.putHash(v[1]); break;
            case TYPE_TAGS  : buf.putTags(v[1]); break;
        }
    });
    return buf.pos(0);
};

Packet.prototype.init = function(buffer) {
    //log.trace('Packet.init() buffer.length: '+buffer.length);
    try {
        this.hasExcess = false;
        this.protocol = buffer.getUInt8();
        if ((this.protocol == PR_ED2K) || (this.protocol == PR_ZLIB) || (this.protocol == PR_EMULE)) {
            this.size = buffer.getUInt32LE()-1;
            this.code = buffer.getUInt8();
            this.data = new Buffer(this.size);
            //log.trace('Packet init: protocol: 0x'+this.protocol.toString(16)+' data size (header): '+this.size+' opcode: 0x'+this.code.toString(16));
            this.append(buffer.get());
        }
        else { // ignore data
            throw { name: 'UNK_PROTO', message: 'Ignoring packet. Protocol: 0x'+this.protocol.toString(16) };
        }
    } catch (err) {
        this.status = PS_NEW;
        log.error(JSON.stringify(err));
        //log.text(hexDump(buffer.slice(0,32)));
    }
    return this;
};

Packet.prototype.append = function(buffer) {
    try {
        var received = this.data.pos();
        this.data.putBuffer(buffer);
        received+= buffer.length;
        if (received < this.data.length) {
            this.status = PS_WAITING_DATA;
        }
        else if (received >= this.size) {
            this.status = PS_READY;
        }
        if (received > this.size) {
            var excess = received - this.size;
            this.excess = buffer.slice(buffer.length - excess);
            var protocol = this.excess.readUInt8(0); // check the first byte of the excess data
            if ((protocol == PR_ED2K) || (protocol == PR_ZLIB) || (protocol == PR_EMULE)) {
                this.hasExcess = true;
                log.info('Excess data ('+excess+' bytes): '+buffer.slice(buffer.length - excess).toString('hex').slice(0,25));
            }
            else {
                this.status = PS_NEW;
            }
        }
        //log.trace('Append: current data size: '+this.data.pos());
    } catch (err) {
        log.error('packet.append: '+err);
        log.text(hexDump(buffer.slice(0,32)));
    }
    return this;
};

exports.Packet = Packet;
