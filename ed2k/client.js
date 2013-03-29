var net = require('net')
var conf = require('../enode.config.js').config
var Packet = require('./packet.js').Packet
var misc = require('./misc.js')
var log = require('tinylogger')
var crypt = require('./crypt.js')
var events = require('events')
var util = require('util')

var MAGICVALUE_SYNC = 0x835E6FC4
var MAGICVALUE_203  = 203
var MAGICVALUE_34   = 34

/**
 * Very basic eD2K client for sending/receiving HELLO packets.
 *
 * Events: error, timeout, connected, data, ophelloanswer, handshake
 */
var Client = function() {
  events.EventEmitter.call(this)
  this.socket = new net.Socket()
  this.crypt = {
    status: conf.enableCrypt ? CS_UNKNOWN : CS_NONE,
  }
}

util.inherits(Client, events.EventEmitter)

exports.Client = Client

Client.prototype.handshake = function() {
  var _this = this
  var padLength = crypt.rand(0xff)
  var randomKey = crypt.rand(0xffffffff)
  var key = new Buffer(21)
  var enc = new Buffer(4+1+1+1+padLength)
  var buf = new Buffer(1+4+4+1+1+1+padLength)

  // calculate the keys
  _this.sendKey = crypt.md5(key
    .putHash(_this.hash)
    .putUInt8(MAGICVALUE_34)
    .putUInt32LE(randomKey))
  _this.recvKey = crypt.md5(key
    .pos(16)
    .putUInt8(MAGICVALUE_203))
  _this.sendKey = crypt.RC4CreateKey(_this.sendKey, true)
  _this.recvKey = crypt.RC4CreateKey(_this.recvKey, true)

  // the encoded part of the packet
  enc.putUInt32LE(MAGICVALUE_SYNC)
  enc.putUInt8(EM_SUPPORTED).putUInt8(EM_PREFERRED)
  enc.putUInt8(padLength).putBuffer(crypt.randBuf(padLength))
  enc = crypt.RC4Crypt(enc, enc.length, _this.sendKey)

  buf.putUInt8(crypt.randProtocol()).putUInt32LE(randomKey).putBuffer(enc)

  _this.crypt.status = CS_NEGOTIATING
  _this.handshakeTimeout = setTimeout(function() {
    _this.emit('timeout', 'handshake')
  }, conf.tcp.connectionTimeout)
  _this.socket.write(buf, function(err) {
    if (err) this.emit('error', err);
  })
}

Client.prototype._decrypt = function(data) {
  var _this = this
  switch (_this.crypt.status) {

    case CS_ENCRYPTING:
      log.trace('Client._decrypt: decrypting')
      return crypt.RC4Crypt(data, data.length, _this.recvKey)

    case CS_NEGOTIATING:
      data = crypt.RC4Crypt(data, data.length, _this.recvKey)
      if (data.getUInt32LE() == MAGICVALUE_SYNC) {
        clearTimeout(this.handshakeTimeout)
        log.trace('Client._decrypt: negotiation response Ok.')
        _this.crypt.method = data.getUInt8() // should be == EM_OBFUSCATE
        data.get(data.getUInt8()) // skip padding
        _this.crypt.status = CS_ENCRYPTING
        if (data.pos() < data.length) {
          log.warn('Client._decrypt: there is more unhandled data!')
          misc.hexDump(data.get())
        }
        _this.emit('handshake', false)
        return false
      }
      else {
        _this.crypt.status = CS_NONE
        _this.emit('handshake', new Error('Bad handshake answer received'))
      }
      return data

    case CS_NONE:
      return data

    case CS_UNKNOWN:
    default:
      log.error('Client._decrypt: we souldn\'t be here')
      return data
  }
}

Client.prototype.connect = function(host, port, hash) {
  var _this = this
  this.hash = hash

  this.socket.on('data', function(data) {
    data = _this._decrypt(data)
    if (data == false) return
    var protocol = data.getUInt8()
    if (protocol == PR_ED2K) {
      var size = data.getUInt32LE()
      var payload = data.get(size)
      var opcode = payload.getUInt8()
      switch (opcode) {
        case OP_HELLOANSWER:
          clearTimeout(_this.opHelloTimeout)
          _this.emit('ophelloanswer', readOpHelloAnswer(payload))
          break
        default:
          log.warn('Client.on data: bad opcode: 0x'+opcode.toString(16))
      }
    }
    else {
      log.error('Client.on data: bad protocol: 0x'+
        protocol.toString(16))
    }
  })

  this.socket.on('error', function(err) {
    _this.emit('error', err)
  })

  this.socket.setTimeout(conf.tcp.connectionTimeout, function() {
    _this.emit('timeout', 'connection')
  })

  this.socket.connect({port: port, host: host, localAddress: conf.address },
    function() {
      _this.emit('connected')
    }
  )

  return this
}

Client.prototype.submit = function(data, callback) {
  if (this.crypt.status == CS_ENCRYPTING) {
      log.trace('Client.submit: encrypt')
      data = crypt.RC4Crypt(data, data.length, this.sendKey)
  }
  log.trace('Client.submit: send data')
  this.socket.write(data, callback)
}

Client.prototype.send = function(operation, info, callback) {
  var pack = [[TYPE_UINT8, operation]]
  var _this = this
  switch (operation) {
    case OP_HELLO:
      pack.push([TYPE_UINT8, 16]) // should be 16
      pack.push([TYPE_HASH, conf.hash])
      pack.push([TYPE_UINT32, misc.IPv4toInt32LE(conf.address)])
      pack.push([TYPE_UINT16, conf.tcp.port])
      pack.push([TYPE_TAGS, [
        [TYPE_STRING, TAG_NAME, ENODE_NAME],
        [TYPE_UINT32, TAG_VERSION, ENODE_VERSIONINT],
      ]])
      pack.push([TYPE_UINT32, misc.IPv4toInt32LE(conf.address)])
      pack.push([TYPE_UINT16, conf.tcp.port])
      _this.opHelloTimeout = setTimeout(function() {
        _this.emit('timeout', 'hello')
      }, conf.tcp.connectionTimeout)
      _this.submit(Packet.make(PR_ED2K, pack), callback)
      break
  }
}

Client.prototype.end = function() {
  this.socket.destroy()
}

var readOpHelloAnswer = function(data) {
  var info = {}
  info.hash = data.get(16)
  info.id = data.getUInt32LE()
  info.port = data.getUInt16LE()
  data.getTags().forEach(function(v) {
    info[v[0]] = v[1]
  })
  info.serverAddress = data.getUInt32LE()
  info.serverPort = data.getUInt16LE()
  if (data.pos() < data.length) {
    log.warn('readOpHelloAnswer excess: '+log.get().toString('hex'))
  }
  return info
}
