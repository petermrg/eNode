var crypto = require('crypto');

// Crypt Status
global.CS_NONE          = 0;
global.CS_UNKNOWN       = 1;
global.CS_NEGOTIATING   = 4;
global.CS_ENCRYPTING    = 5;

// Encryption Methods
global.EM_OBFUSCATE     = 0;
global.EM_PREFERRED     = EM_OBFUSCATE;
global.EM_SUPPORTED     = EM_OBFUSCATE;

global.CRYPT_PRIME_SIZE = 96;
global.CRYPT_DHA_SIZE   = 16;

global.CRYPT_PRIME = new Buffer([
    0xF2,0xBF,0x52,0xC5,0x5F,0x58,0x7A,0xDD,0x53,0x71,0xA9,0x36,
    0xE8,0x86,0xEB,0x3C,0x62,0x17,0xA3,0x3E,0xC3,0x4C,0xB4,0x0D,
    0xC7,0x3A,0x41,0xA6,0x43,0xAF,0xFC,0xE7,0x21,0xFC,0x28,0x63,
    0x66,0x53,0x5B,0xDB,0xCE,0x25,0x9F,0x22,0x86,0xDA,0x4A,0x91,
    0xB2,0x07,0xCB,0xAA,0x52,0x55,0xD4,0xF6,0x1C,0xCE,0xAE,0xD4,
    0x5A,0xD5,0xE0,0x74,0x7D,0xF7,0x78,0x18,0x28,0x10,0x5F,0x34,
    0x0F,0x76,0x23,0x87,0xF8,0x8B,0x28,0x91,0x42,0xFB,0x42,0x68,
    0x8F,0x05,0x15,0x0F,0x54,0x8B,0x5F,0x43,0x6A,0xF7,0x0D,0xF3,
]);

/**
 * @description Creates a RC4 key
 * @param {Buffer} buffer Keyphrase
 * @drop {Boolean} drop Set true to drop first 1024 bytes
 * @returns {Object} The key
 */
var RC4CreateKey = function(buffer, drop) {
    var key = { state: [], x: 0, y: 0 };
    var len = buffer.length;
    var index1 = 0;
    var index2 = 0;
    var swap = 0;
    var i = 0;
    for (i=0; i<256; i++) { key.state[i] = i; }
    for (i=0; i<256; i++) {
        index2 = (buffer[index1] + key.state[i] + index2) % 256;
        swap = key.state[i];
        key.state[i] = key.state[index2];
        key.state[index2] = swap;
        index1 = (index1 + 1) % len;
    }
    if (drop) {
        RC4Crypt(null, 1024, key);
    }
    return key;
};
exports.RC4CreateKey = RC4CreateKey;

/**
 * @description Encrypt/Decrypt using RC4 algorithm
 * @param {Buffer} buffer Data to encode or decode
 * @param {Integer} length Data size in bytes
 * @param {Object} key The RC4 key created with RC4CreateKey
 * @returns {Buffer} Output data buffer
 */
var RC4Crypt = function(buffer, length, key){
    if (key == null) return;
    var swap = 0;
    var xorIndex = 0;
    if (buffer != null) { var output = new Buffer(length); }
    else { output = null; }
    for (var i=0; i<length; i++) {
        key.x = (key.x + 1) % 256;
        key.y = (key.state[key.x] + key.y) % 256;
        swap = key.state[key.x];
        key.state[key.x] = key.state[key.y];
        key.state[key.y] = swap;
        xorIndex = (key.state[key.x] + key.state[key.y]) % 256;
        if (buffer != null) { output[i] = (buffer[i] ^ key.state[xorIndex]) % 256; }
    }
    return output;
};
exports.RC4Crypt = RC4Crypt;

exports.RC4KeyCopy = function(key){
    return {
        x: key.x,
        y: key.y,
        state: key.state.slice()
    };
}

/**
 * @description Calculates a md5 hash
 * @param {Buffer} buffer input data
 * @returns {Buffer} Output data
 */
exports.md5 = function(buffer) {
    var md5 = crypto.createHash('md5');
    md5.update(buffer.toString('binary'));
    return new Buffer(md5.digest('binary'), 'binary');
}

/**
 * @description Returns random value between 0 and n (both included)
 * @param {Integer} n
 * @returns {Integer} pseudo-random number (0..n)
 */
exports.rand = function(n) {
    return Math.round(Math.random() * n);
}

/**
 * @description Returns a buffer filled with random data
 * @param {Integer} length of the returned buffer
 * @returns {Buffer} random data
 */
exports.randBuf = function(length) {
    return new Buffer(crypto.randomBytes(length), 'binary');
}

/**
 * @description Returns an invalid random protocol code.
 * @returns {Integer}
 */
exports.randProtocol = function() {
    var p = 0xff;
    var i = 5;
    while (i--) {
        p = exports.rand(0xff);
        if ((p != PR_ED2K) && (p != PR_EMULE) && (p != PR_ZLIB)) break;
    }
    return p;
}
