var log = require('tinylogger');
var crypt = require('./crypt.js');
var misc = require('./misc.js');
var conf = require('../enode.config.js').config;
var hexDump = require('hexy').hexy;
require('./buffer.js');

/*
* Keycreation Client <-> Server:
    * Client A (Outgoing connection client -> server):
        Sendkey:    Md5(<BaseKey 4><MagicValueClientServer 1><RandomKeyPartClientA 2>)  7
    * Client B (Incomming connection):
        Receivekey: Md5(<BaseKey 4><MagicValueServerClient 1><RandomKeyPartClientA 2>)  7
    * Note: The first 1024 Bytes will be _NOT_ discarded for UDP keys to safe CPU time

* Handshake
    * The handshake is encrypted (except otherwise noted) by the Keys created above
    * Padding is currently not used for UDP meaning that PaddingLen will be 0, using PaddingLengths
      up to 16 Bytes is acceptable however.

    Client A: <SemiRandomNotProtocolMarker 1[Unencrypted]><RandomKeyPart 2[Unencrypted]>
        <MagicValue 4><PaddingLen 1><RandomBytes PaddingLen%16>

* Overhead: 8 Bytes per UDP Packet

* Security for Basic Obfuscation:
    * Random looking packets, very limited protection against passive eavesdropping single packets

* Additional Comments:
    * For obvious reasons the UDP handshake is actually no handshake. If a different Encryption
      method (or better a different Key) is to be used this has to be negotiated in a TCP
      connection.
    * SemiRandomNotProtocolMarker is a Byte which has a value unequal any Protocol header byte.
      This is a compromiss, turning in complete randomness (and nice design) but gaining a lower
      CPU usage.

*/

var MAGICVALUE_UDP_SERVERCLIENT = 0xA5;
var MAGICVALUE_UDP_CLIENTSERVER = 0x6B;
var MAGICVALUE_UDP_SYNC_CLIENT  = 0x395F2EC1;
var MAGICVALUE_UDP_SYNC_SERVER  = 0x13EF24D5;

var recvKeys = new Buffer(0xffffff);
var sendKeys = new Buffer(0xffffff);

(function() { // Precalculate all possible keys (2*0xffff different 256B keys = 32MB).
    log.info('UDP crypt keys init. Server key: '+
        conf.udp.serverKey+' (0x'+conf.udp.serverKey.toString(16)+')');
    log.info('UDP crypt keys init');
    var sendBuf = new Buffer(7);
    var recvBuf = new Buffer(7);
    sendBuf.putUInt32LE(conf.udp.serverKey).putUInt8(MAGICVALUE_UDP_SERVERCLIENT);
    recvBuf.putUInt32LE(conf.udp.serverKey).putUInt8(MAGICVALUE_UDP_CLIENTSERVER);
    for (var i=0; i<0x10000; i++) {
        sendBuf.pos(5).putUInt16LE(i);
        recvBuf.pos(5).putUInt16LE(i);
        sendKeys.putBuffer(crypt.RC4CreateKey(crypt.md5(sendBuf), false).state);
        recvKeys.putBuffer(crypt.RC4CreateKey(crypt.md5(recvBuf), false).state);
    }
})();

/**
 * @class Crypt for UDP
 * @constructor
 * @property {Integer} status
 */
var udpCrypt = function() {
    this.status = conf.supportCrypt ? CS_ENCRYPTING : CS_NONE;
};

/**
 * @description Decrypt buffer when needed
 * @param {Buffer} buffer Input data
 * @param {Buffer} info Input data
 * @returns {Buffer} Decrypted data
 */
udpCrypt.prototype.decrypt = function(buffer, info) {
    switch (this.status) {

        case CS_ENCRYPTING:
            var protocol = buffer.getUInt8();
            if ((protocol != PR_ED2K) && (protocol != PR_EMULE) && (protocol != PR_ZLIB)) {
                log.trace('udpCrypt: decrypting data from '+info.address);
                var clientKey = buffer.getUInt16LE();
                var b = buffer.get();
                var key = crypt.RC4KeyCopy(recvKeys[clientKey]); // use a fresh key
                b = crypt.RC4Crypt(b, b.length, key);
                if (b.getUInt32LE() == MAGICVALUE_UDP_SYNC_SERVER) {
                    var padLength = b.getUInt8();
                    b.get(padLength); // Skip padding
                    return b.get(); // The rest of the packet is the decrypted data
                }
                else {
                    log.warn('Error decrypting UDP packet');
                }
            }

        case CS_NONE:
        default:
            buffer.pos(0);
            return buffer;
    }
};

/**
 * @description Encrypts an UDP packet
 * @param {Buffer} buffer Input data
 * @return {Buffer} Encrypted data
 */
udpCrypt.prototype.encrypt = function(buffer) {
    var randomKey = crypt.rand(0xffff);
    // crypted part
    var enc = new Buffer(buffer.length + 5);
    enc.putUInt32LE(MAGICVALUE_UDP_SYNC_SERVER).putUInt8(0).putBuffer(buffer);
    enc = crypt.RC4Crypt(enc, enc.length, sendKeys[randomKey]);
    // return buffer
    var ret = new Buffer(buffer.length + 8);
    return ret.putUInt8(crypt.randProtocol()).putUInt16LE(randomKey).putBuffer(enc);
}

exports.udpCrypt = udpCrypt;
