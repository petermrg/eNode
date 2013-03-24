var log = require('tinylogger')
var crypt = require('./crypt.js')
var misc = require('./misc.js')
var conf = require('../enode.config.js').config
var fs = require('fs')
require('./buffer.js')

var MAGICVALUE_UDP_SERVERCLIENT = 0xA5
var MAGICVALUE_UDP_CLIENTSERVER = 0x6B
var MAGICVALUE_UDP_SYNC_CLIENT  = 0x395F2EC1
var MAGICVALUE_UDP_SYNC_SERVER  = 0x13EF24D5
var sendKeys = new Buffer(0xffffff)
var recvKeys = new Buffer(0xffffff)

// Precalculate all possible keys (2*0xffff different 256B keys = 32MB).
;(function() {
  var fn = 'udpkeys-'+conf.udp.serverKey.toString(16)+'.dat'
  if (fs.existsSync(fn)) {
    var fd = fs.openSync(fn, 'r')
    fs.readSync(fd, sendKeys, 0, 0xffffff, 0)
    fs.readSync(fd, recvKeys, 0, 0xffffff, 0x1000000)
    fs.closeSync(fd);
  }
  else {
    var fd = fs.openSync(fn, 'w')
    log.info('UDP Server key: 0x'+conf.udp.serverKey.toString(16))
    log.info('UDP crypt keys init...')
    var sendKey = new Buffer(7)
    var recvKey = new Buffer(7)
    sendKey
      .putUInt32LE(conf.udp.serverKey)
      .putUInt8(MAGICVALUE_UDP_SERVERCLIENT)
    recvKey
      .putUInt32LE(conf.udp.serverKey)
      .putUInt8(MAGICVALUE_UDP_CLIENTSERVER)
    for (var i=0; i<0x10000; i++) {
      sendKey.pos(5).putUInt16LE(i)
      recvKey.pos(5).putUInt16LE(i)
      sendKeys.putBuffer(crypt.RC4CreateKey(crypt.md5(sendKey), false).state)
      recvKeys.putBuffer(crypt.RC4CreateKey(crypt.md5(recvKey), false).state)
    }
    fs.writeSync(fd, sendKeys, 0, 0xffffff, 0)
    fs.writeSync(fd, recvKeys, 0, 0xffffff, 0x1000000)
    fs.closeSync(fd)
  }
})()

/**
 * Gets an RC4Key from the Keys Buffer
 *
 * @param {Integer} index Position of the key in the buffer
 * @returns {Object} RC4 Key object
 */
var getKey = function(keysBuffer, index) {
  var buf = new Buffer(256)
  var start = index<<8
  keysBuffer.copy(buf, 0, start, start+256)
  return { x: 0, y: 0, state: buf }
}

/**
 * Crypt class for UDP
 *
 * @class Crypt for UDP
 * @constructor
 * @property {Integer} status
 */
var udpCrypt = function() {
  this.status = conf.supportCrypt ? CS_ENCRYPTING : CS_NONE
}

/**
 * Decrypt buffer when needed
 *
 * @param {Buffer} buffer Input data
 * @param {Buffer} info Input data
 * @returns {Buffer} Decrypted data
 */
udpCrypt.prototype.decrypt = function(buffer, info) {
  switch (this.status) {

    case CS_ENCRYPTING:
      var protocol = buffer.getUInt8()
      if (!misc.isProtocol(protocol)) {
        log.trace('udpCrypt: decrypting data from '+info.address)
        var clientKey = buffer.getUInt16LE()
        var b = buffer.get()
        b = crypt.RC4Crypt(b, b.length, getKey(recvKeys, clientKey))
        if (b.getUInt32LE() == MAGICVALUE_UDP_SYNC_SERVER) {
          var padLength = b.getUInt8()
          b.get(padLength) // Skip padding
          return b.get() // The rest of the packet is the decrypted data
        }
        else {
          log.warn('Error decrypting UDP packet')
        }
      }

    case CS_NONE:
    default:
      buffer.pos(0)
      return buffer
  }
}

/**
 * Encrypts an UDP packet
 *
 * @param {Buffer} buffer Input data
 * @return {Buffer} Encrypted data
 */
udpCrypt.prototype.encrypt = function(buffer) {
  var randomKey = crypt.rand(0xffff)
  var enc = new Buffer(buffer.length + 5)
  var ret = new Buffer(buffer.length + 8)

  // crypted part
  enc.putUInt32LE(MAGICVALUE_UDP_SYNC_SERVER)
    .putUInt8(0)
    .putBuffer(buffer)
  enc = crypt.RC4Crypt(enc, enc.length, getKey(sendKeys, randomKey))

  // return buffer
  return ret.putUInt8(crypt.randProtocol())
    .putUInt16LE(randomKey)
    .putBuffer(enc)
}

exports.udpCrypt = udpCrypt
