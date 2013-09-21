var conf = require('../enode.config.js').config
var log = require('tinylogger')
var hexDump = require('hexy').hexy
var crypt = require('./crypt.js')
var bigint = require('../lib/biginteger.js').BigInteger

var MAGICVALUE_SYNC      = 0x835E6FC4
var MAGICVALUE_SERVER    = 203
var MAGICVALUE_REQUESTER = 34

var TcpCrypt = function(packet) {
  log.trace('TCP Crypt init')
  this.packet = packet
  this.status = conf.supportCrypt ? CS_UNKNOWN : CS_NONE
}
exports.TcpCrypt = TcpCrypt

TcpCrypt.prototype.process = function(buffer) {
  this.packet.data = buffer.get()
  switch (this.status) {
    case CS_NONE:
      log.warn('crypt.process: Obfuscation disabled')
      break
    case CS_UNKNOWN:
      log.trace('TcpCrypt.process: Negotiation start')
      this.negotiate()
      this.packet.status = PS_CRYPT_NEGOTIATING
      this.status = CS_NEGOTIATING
      break
    case CS_NEGOTIATING:
      log.trace('TcpCrypt.process: Negotiation response')
      var that = this
      this.handshake(buffer, function(err, data) {
        if (err != false) {
          log.error(err)
          that.packet.client.end()
        }
        else {
          that.status = CS_ENCRYPTING
          that.packet.status = PS_NEW
          that.packet.init(data)
        }
      })
      break
    default:
      log.error('TcpCrypt.process: I shouldn\'t be here!')
      console.trace()
  }
}

TcpCrypt.prototype.negotiate = function() {
  var g = bigint(2)
  var p = bigint.fromBuffer(CRYPT_PRIME)
  var A = bigint.fromBuffer(this.packet.data.get(CRYPT_PRIME_SIZE))
  var b = bigint.fromBuffer(crypt.randBuf(CRYPT_DHA_SIZE))
  var B = bigint.powm(g, b, p).toBuffer()
  var K = bigint.powm(A, b, p).toBuffer()

  var padSize = this.packet.data.getUInt8()
  var pad = this.packet.data.get(padSize)
  // log.debug('Excess (should be 0): '+
  // (this.packet.data.length-this.packet.data.pos()))
  var buf = new Buffer(CRYPT_PRIME_SIZE+1)

  buf.putBuffer(K)

  // create RC4 send key
  buf.putUInt8(MAGICVALUE_SERVER)
  this.sendKey = crypt.RC4CreateKey(crypt.md5(buf), true)

  // create RC4 receive key
  buf[CRYPT_PRIME_SIZE] = MAGICVALUE_REQUESTER
  this.recvKey = crypt.RC4CreateKey(crypt.md5(buf), true)

  var padSize = crypt.rand(16)
  var rc4Buf = new Buffer(4+1+1+1+padSize)
  var packet = new Buffer(CRYPT_PRIME_SIZE+rc4Buf.length)

  rc4Buf.putUInt32LE(MAGICVALUE_SYNC)
  rc4Buf.putUInt8(EM_SUPPORTED)
  rc4Buf.putUInt8(EM_PREFERRED)
  rc4Buf.putUInt8(padSize)
  rc4Buf.putBuffer(crypt.randBuf(padSize))

  packet.putBuffer(B)
  packet.putBuffer(crypt.RC4Crypt(rc4Buf, rc4Buf.length, this.sendKey))

  this.packet.client.write(packet, function(err) {
    if (err) log.error(
      'TcpCrypt.negotiate Client write failed: '+
      JSON.stringify(err)
    )
  })
}

/**
 * Reads the handshake response from client, checks the MAGICVALUE_SYNC
 * constant and checks the encryption method selected by client.
 *
 * @param {Buffer} buffer Incoming data
 * @param {Function} callback(err, data)
 * @returns {Boolean} True on correct handshake or False on error.
 */
TcpCrypt.prototype.handshake = function(buffer, callback) {
  if (this.status == CS_NEGOTIATING) {
    var data = crypt.RC4Crypt(buffer, buffer.length, this.recvKey)
    if (data.getUInt32LE() != MAGICVALUE_SYNC) {
      callback({'message': 'Wrong MAGICVALUE_SYNC'})
      return
    }
    if (data.getUInt8() != EM_OBFUSCATE) {
      callback({'message': 'encryption method not supported'})
      return
    }
    data.get(data.getUInt8()) // discard pad bytes
    callback(false, data.get())
    return
  }
  else {
    callback({'message': 'bad crypt status'})
  }
}

/**
 * Decrypt buffer when needed
 *
 * @param {Buffer} buffer
 * @returns {Buffer} data
 */
TcpCrypt.prototype.decrypt = function(buffer) {
  if (this.status == CS_ENCRYPTING) {
    return crypt.RC4Crypt(buffer, buffer.length, this.recvKey)
  }
  else {
    return buffer
  }
}
