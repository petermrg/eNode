var net = require('net');
var conf = require('../enode.config.js').config;
var Packet = require('./packet.js').Packet;
var misc = require('./misc.js');
var log = require('tinylogger');
var crypt = require('./crypt.js');

/*
# Basic Obfuscated Handshake Protocol Client <-> Client #

## Keycreation ##
    * Client A (Outgoing connection):
        Sendkey:    Md5(<UserHashClientB 16><MagicValue34 1><RandomKeyPartClientA 4>)  21
        Receivekey: Md5(<UserHashClientB 16><MagicValue203 1><RandomKeyPartClientA 4>) 21
    * Client B (Incomming connection):
        Sendkey:    Md5(<UserHashClientB 16><MagicValue203 1><RandomKeyPartClientA 4>) 21
        Receivekey: Md5(<UserHashClientB 16><MagicValue34 1><RandomKeyPartClientA 4>)  21
    NOTE: First 1024 Bytes are discarded

## Handshake ##
    * The handshake is encrypted -except otherwise noted- by the Keys created above
    * Handshake is blocking - do not start sending an answer before the request is completly
      received (this includes the random bytes)
    * EncryptionMethod = 0 is Obfuscation and the only supported right now

        Client A: <SemiRandomNotProtocolMarker 1[Unencrypted]><RandomKeyPart 4[Unencrypted]>
            <MagicValue 4><EncryptionMethodsSupported 1><EncryptionMethodPreferred 1>
            <PaddingLen 1><RandomBytes PaddingLen%max256>

        Client B: <MagicValue 4><EncryptionMethodsSelected 1>
            <PaddingLen 1><RandomBytes PaddingLen%max256>

    * The basic handshake is finished here, if an additional/different EncryptionMethod was
      selected it may continue negotiating details for this one

* Overhead: 18-48 (~33) Bytes + 2 * IP/TCP Headers per Connection

* Security for Basic Obfuscation:
    * Random looking stream, very limited protection against passive eavesdropping single
      connections

* Additional Comments:
    * RandomKeyPart is needed to make multiple connections between two clients look different
      (but still random), since otherwise the same key would be used and RC4 would create the
      same output. Since the key is a MD5 hash it doesnt weakens the key if that part is known.
    * Why DH-KeyAgreement isn't used as basic obfuscation key: It doesn't offers substantial
      more protection against passive connection based protocol identification, it has about
      200 bytes more overhead, needs more CPU time, we cannot say if the received data is junk,
      unencrypted or part of the keyagreement before the handshake is finished without loosing
      the complete randomness, it doesn't offers substantial protection against eavesdropping
      without added authentification.
*/
var MAGICVALUE_SYNC = 0x835E6FC4;
var MAGICVALUE_203  = 203;
var MAGICVALUE_34   = 34;


/**
 * @description This is a very basic eD2K client for sending/receiving HELLO packets.
 */
var Client = function() {
    this.socket = new net.Socket();
    this.crypt = {
        status: conf.enableCrypt ? CS_UNKNOWN : CS_NONE,
    };
    this._error = function(){};
    this._timeout = function(){};
    this._connected = function(){};
    this._data = function(){};
    this._opHelloAnswer = function(){};
    this._handshake = function(){};
}

exports.Client = Client;

Client.prototype.handshake = function() {
    var t = this;
    var padLength = crypt.rand(0xff);
    var randomKey = crypt.rand(0xffffffff);

    var key = new Buffer(21);
    t.sendKey = crypt.md5(key.putHash(t.hash).putUInt8(MAGICVALUE_34).putUInt32LE(randomKey));
    t.recvKey = crypt.md5(key.pos(16).putUInt8(MAGICVALUE_203));
    t.sendKey = crypt.RC4CreateKey(t.sendKey, true);
    t.recvKey = crypt.RC4CreateKey(t.recvKey, true);

    var enc = new Buffer(4+1+1+1+padLength);
    enc.putUInt32LE(MAGICVALUE_SYNC);
    enc.putUInt8(EM_SUPPORTED).putUInt8(EM_PREFERRED);
    enc.putUInt8(padLength).putBuffer(crypt.randBuf(padLength));
    enc = crypt.RC4Crypt(enc, enc.length, t.sendKey);

    var buf = new Buffer(1+4+4+1+1+1+padLength);
    buf.putUInt8(crypt.randProtocol()).putUInt32LE(randomKey).putBuffer(enc);

    t.crypt.status = CS_NEGOTIATING;
    t.handshakeTimeout = setTimeout(function(){
        t._timeout('handshake');
    }, conf.tcp.connectionTimeout);
    t.socket.write(buf, function(err){
        if (err) {
            t._error(err);
        }
    });
};

Client.prototype._decrypt = function(data) {
    var t = this;
    switch (t.crypt.status) {

        case CS_ENCRYPTING:
            log.trace('Client._decrypt: Decrypting');
            data = crypt.RC4Crypt(data, data.length, t.recvKey);
            break;

        case CS_NEGOTIATING:
            data = crypt.RC4Crypt(data, data.length, t.recvKey);
            if (data.getUInt32LE() == MAGICVALUE_SYNC) {
                clearTimeout(this.handshakeTimeout);
                log.trace('Client._decrypt: Negotiation response Ok.');
                t.crypt.method = data.getUInt8(); // should be == EM_OBFUSCATE
                data.get(data.getUInt8()); // skip padding
                t.crypt.status = CS_ENCRYPTING;
                if (data.pos() < data.length) {
                    log.warn('Client._decrypt: there is more unhandled data!');
                    misc.hexDump(data.get());
                }
                t._handshake(false);
                return false;
            }
            else {
                r.crypt.status = CS_NONE;
                t._handshake({message: 'Bad handshake answer received'});
            }
            return data;

        case CS_NONE:
            return data;

        case CS_UNKNOWN:
        default:
            log.error('Client._decrypt: We souldn\'t be here');
            return data;
    }
}

Client.prototype.connect = function(host, port, hash) {

    var t = this;
    this.hash = hash;

    this.socket.on('data', function(data) {
        data = t._decrypt(data);
        if (data == false) return;
        var protocol = data.getUInt8();
        if (protocol == PR_ED2K) {
            var size = data.getUInt32LE();
            var d = data.get(size);
            var opcode = d.getUInt8();
            switch (opcode) {
                case OP_HELLOANSWER:
                    clearTimeout(t.opHelloTimeout);
                    t._opHello(readOpHelloAnswer(d));
                    break;
                default: log.warn('eD2K CLient: Unhandled opcode: 0x'+opcode.toString(16));
            }
        }
        else {
            log.error('eD2K Client: incoming data: bad protocol: 0x'+protocol.toString(16));
        }
    });

    this.socket.on('error', function(err) {
        t._error(err);
    });

    this.socket.setTimeout(conf.tcp.connectionTimeout, function() {
        t._timeout('connection');
    });

    this.socket.connect({port: port, host: host, localAddress: conf.address }, function() {
        t._connected();
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
        case 'handshake': this._handshake = callback; break;
    }
    return this;
};

//global.TAG_EMULE_OPTIONS_1 = 0xfa;

Client.prototype.send = function(operation, info, callback) {
    var pack = [[TYPE_UINT8, operation]];
    var t = this;
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
            t.opHelloTimeout = setTimeout(function(){
                t._timeout('hello');
            }, conf.tcp.connectionTimeout);
            t.socket.write(Packet.make(PR_ED2K, pack), callback);
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
