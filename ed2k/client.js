var net = require('net');
var hexDump = require('hexy').hexy;
var conf = require('../enode.config.js').config;
var Packet = require('./packet.js').Packet;
//var zlib = require('zlib');
var misc = require('./misc.js');
var log = require('tinylogger');

/**
 * @description This is a very basic eD2K client for sending/receiving HELLO packets.
 */
var Client = function() {
    this.socket = new net.Socket();
    this._error = function(){};
    this._timeout = function(){};
    this._connected = function(){};
    this._data = function(){};
    this._opHelloAnswer = function(){};
}

exports.Client = Client;

Client.prototype.connect = function(host, port) {

    var c = this;

    this.socket.on('data', function(data) {
        var protocol = data.getUInt8();
        if (protocol == PR_ED2K) {
            var size = data.getUInt32LE();
            var d = data.get(size);
            var opcode = d.getUInt8();
            switch (opcode) {
                case OP_HELLOANSWER: c._opHello(readOpHelloAnswer(d)); break;
                default: log.warn('eD2K CLient: Unhandled opcode: 0x'+opcode.toString(16));
            }
        }
        else {
            log.error('eD2K Client: incoming data: bad protocol: 0x'+protocol.toString(16));
        }
        //data.pos(0);
        //c._data(data);
    });

    this.socket.on('error', function(err) {
        c._error(err);
    });

    this.socket.setTimeout(conf.tcp.connectionTimeout, function() {
        c._timeout();
    });

    this.socket.connect({port: port, host: host, localAddress: conf.address }, function() {
        c._connected();
    });

    return this;
};

Client.prototype.on = function(event, callback) {
    switch (event) {
        case 'error': this._error = callback; break;
        case 'timeout': this._timeout = callback; break;
        case 'connected': this._connected = callback; break;
        case 'data': this._data = callback; break;
        case 'opHelloAnswer': this._opHello = callback; break;
    }
    return this;
};

//global.TAG_EMULE_OPTIONS_1 = 0xfa;

Client.prototype.send = function(operation, info, callback) {
    var pack = [[TYPE_UINT8, operation]];
    switch (operation) {
        case OP_HELLO:
            pack.push([TYPE_UINT8, 16]); // should be 16
            pack.push([TYPE_HASH, conf.hash]);
            pack.push([TYPE_UINT32, misc.IPv4toInt32LE(conf.address)]);
            pack.push([TYPE_UINT16, conf.tcp.port]);
            pack.push([TYPE_TAGS, [
                [TYPE_STRING, TAG_NAME, ENODE_NAME],
                [TYPE_UINT32, TAG_VERSION, ENODE_VERSIONINT],
            ]]);
            pack.push([TYPE_UINT32, misc.IPv4toInt32LE(conf.address)]);
            pack.push([TYPE_UINT16, conf.tcp.port]);
            this.socket.write(Packet.make(PR_ED2K, pack), callback);
            break;
    }
};

Client.prototype.end = function() {
    this.socket.destroy();
};

var readOpHelloAnswer = function(data) {
    var info = {};
    info.hash = data.get(16);
    info.id = data.getUInt32LE();
    info.port = data.getUInt16LE();
    info.tags = data.getTags();
    info.serverAddress = data.getUInt32LE();
    info.serverPort = data.getUInt16LE();
    if (data.pos() < data.length) {
        log.warn('readOpHelloAnswer Excess: '+log.get().toString('hex'));
    }
    return info;
};
