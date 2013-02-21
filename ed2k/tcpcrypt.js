var conf = require('../enode.config.js').config;
var crypto = require('crypto');
var log = require('tinylogger');
var hexDump = require('hexy').hexy;
var bigInt = require('bigint');
var misc = require('./misc.js');

// Crypt Status
global.CS_NONE        = 0;
global.CS_UNKNOWN     = 1;
global.CS_NEGOTIATING = 4;
global.CS_ENCRYPTING  = 5;

// Encryprion Methods
var EM_OBFUSCATE = 0;
var EM_PREFERRED = EM_OBFUSCATE;
var EM_SUPPORTED = EM_OBFUSCATE;

var MAGICVALUE_SYNC      = 0x835E6FC4;
var MAGICVALUE_SERVER    = 203;
var MAGICVALUE_REQUESTER = 34;

var CRYPT_PRIME_SIZE     = 96;
var CRYPT_DHA_SIZE       = 16;

var CRYPT_PRIME = new Buffer([
    0xF2,0xBF,0x52,0xC5,0x5F,0x58,0x7A,0xDD,0x53,0x71,0xA9,0x36,
    0xE8,0x86,0xEB,0x3C,0x62,0x17,0xA3,0x3E,0xC3,0x4C,0xB4,0x0D,
    0xC7,0x3A,0x41,0xA6,0x43,0xAF,0xFC,0xE7,0x21,0xFC,0x28,0x63,
    0x66,0x53,0x5B,0xDB,0xCE,0x25,0x9F,0x22,0x86,0xDA,0x4A,0x91,
    0xB2,0x07,0xCB,0xAA,0x52,0x55,0xD4,0xF6,0x1C,0xCE,0xAE,0xD4,
    0x5A,0xD5,0xE0,0x74,0x7D,0xF7,0x78,0x18,0x28,0x10,0x5F,0x34,
    0x0F,0x76,0x23,0x87,0xF8,0x8B,0x28,0x91,0x42,0xFB,0x42,0x68,
    0x8F,0x05,0x15,0x0F,0x54,0x8B,0x5F,0x43,0x6A,0xF7,0x0D,0xF3,
]);

var TcpCrypt = function(packet) {
    log.trace('Loading TcpCrypt extension');
    this.packet = packet;
    this.status = conf.supportCrypt ? CS_UNKNOWN : CS_NONE;
}
exports.TcpCrypt = TcpCrypt;

TcpCrypt.prototype.process = function(buffer) {
    this.packet.data = buffer.get();
    switch (this.status) {
        case CS_NONE:
            log.warn('crypt.process: Obfuscation disabled');
            break;
        case CS_UNKNOWN:
            this.negotiate();
            this.packet.status = PS_CRYPT_NEGOTIATING;
            this.status = CS_NEGOTIATING;
            break;
        case CS_NEGOTIATING:
            log.info('TcpCrypt.process: Negotiation response');
            var that = this;
            this.handshake(buffer, function(err, data){
                if (err != false) {
                    log.error(err);
                    that.packet.client.end();
                }
                else {
                    that.status = CS_ENCRYPTING;
                    that.packet.status = PS_NEW;
                    that.packet.init(data);
                }
            });
            break;
        default:
            log.error('TcpCrypt.process: I shouldn\'t be here!');
            console.trace();
    }
};

TcpCrypt.prototype.negotiate = function() {
/*
## Diffie-Hellman public keys exchange ##

Client                                   Server
-----------------------------------------------
a, g, p                                 b, g, p
A = g^a mod p    ----- A ---->    B = g^b mod p
K = B^a mod p    <---- B -----    K = A^b mod p
-----------------------------------------------
g => generator (2)
p => prime number (CRYPT_PRIME)
a, b => random numbers
A, B => public keys
K(Client) == K(Server)
*/
    var g = bigInt(2);
    var p = bigInt.fromBuffer(CRYPT_PRIME);
    var A = bigInt.fromBuffer(this.packet.data.get(CRYPT_PRIME_SIZE));
    var b = bigInt.fromBuffer(crypto.randomBytes(CRYPT_DHA_SIZE));
    var B = bigInt.powm(g, b, p).toBuffer();
    var K = bigInt.powm(A, b, p).toBuffer();

    var padSize = this.packet.data.getUInt8();
    var pad = this.packet.data.get(padSize);
    //log.debug('Excess (should be 0): '+(this.packet.data.length-this.packet.data.pos()));

    var buf = new Buffer(CRYPT_PRIME_SIZE+1);
    buf.putBuffer(K);

    buf.putUInt8(MAGICVALUE_SERVER);
    this.sKey = misc.RC4CreateKey(misc.md5(buf)); // create RC4 send key

    buf[CRYPT_PRIME_SIZE] = MAGICVALUE_REQUESTER;
    this.rKey = misc.RC4CreateKey(misc.md5(buf)); // create RC4 receive key

    var padSize = misc.rand(16);
    var rc4Buf = new Buffer(4+1+1+1+padSize);
    var packet = new Buffer(CRYPT_PRIME_SIZE+rc4Buf.length);

    rc4Buf.putUInt32LE(MAGICVALUE_SYNC);
    rc4Buf.putUInt8(EM_SUPPORTED);
    rc4Buf.putUInt8(EM_PREFERRED);
    rc4Buf.putUInt8(padSize);
    rc4Buf.putBuffer(misc.randBuf(padSize));

    packet.putBuffer(B);
    packet.putBuffer(misc.RC4Crypt(rc4Buf, rc4Buf.length, this.sKey));

    this.packet.client.write(packet, function(err) {
        if (err) log.error('TcpCrypt.negotiate Client write failed: '+JSON.stringify(err));
    });
};

/**
 * @description Reads the handshake response from client, checks the MAGICVALUE_SYNC constant and
 * checks the encryption method selected by client.
 * @param {Buffer} buffer Incoming data
 * @param {Function} callback(err, data)
 * @returns {Boolean} True on correct handshake or False on error.
 */
TcpCrypt.prototype.handshake = function(buffer, callback) {
    if (this.status == CS_NEGOTIATING) {
        var data = misc.RC4Crypt(buffer, buffer.length, this.rKey);
        if (data.getUInt32LE() != MAGICVALUE_SYNC) {
            callback({'message': 'Wrong MAGICVALUE_SYNC'});
            return;
        }
        if (data.getUInt8() != EM_OBFUSCATE) {
            callback({'message': 'encryption method not supported'});
            return;
        }
        data.get(data.getUInt8()); // discard pad bytes
        callback(false, data.get());
        return;
    }
    else {
        callback({'message': 'bad crypt status'});
    }
};

/**
 * @description Decrypt buffer if needed
 * @param {Buffer} buffer
 * @returns {Buffer} data
 */
TcpCrypt.prototype.decrypt = function(buffer) {
    if (this.status == CS_ENCRYPTING) {
        return misc.RC4Crypt(buffer, buffer.length, this.rKey);
    }
    else {
        return buffer;
    }
};
