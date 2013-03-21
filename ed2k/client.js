var net = require('net'),
    conf = require('../enode.config.js').config,
    Packet = require('./packet.js').Packet,
    misc = require('./misc.js'),
    log = require('tinylogger'),
    crypt = require('./crypt.js')

var MAGICVALUE_SYNC = 0x835E6FC4,
    MAGICVALUE_203  = 203,
    MAGICVALUE_34   = 34

/**
 * Very basic eD2K client for sending/receiving HELLO packets.
 */
var Client = function() {
  this.socket = new net.Socket()
  this.crypt = {
    status: conf.enableCrypt ? CS_UNKNOWN : CS_NONE,
  }
  this._error = function() {}
  this._timeout = function() {}
  this._connected = function() {}
  this._data = function() {}
  this._opHelloAnswer = function() {}
  this._handshake = function() {}
}

exports.Client = Client

Client.prototype.handshake = function() {
  var _this = this,
    padLength = crypt.rand(0xff),
    randomKey = crypt.rand(0xffffffff),
    key = new Buffer(21),
    enc = new Buffer(4+1+1+1+padLength),
    buf = new Buffer(1+4+4+1+1+1+padLength)

  // calculate the keys
  _this.sendKey = crypt.md5(key
    .putHash(t.hash)
    .putUInt8(MAGICVALUE_34)
    .putUInt32LE(randomKey))
  _this.recvKey = crypt.md5(key
    .pos(16)
    .putUInt8(MAGICVALUE_203))
  _this.sendKey = crypt.RC4CreateKey(t.sendKey, true)
  _this.recvKey = crypt.RC4CreateKey(t.recvKey, true)

  // the encoded part of the packet
  enc.putUInt32LE(MAGICVALUE_SYNC)
  enc.putUInt8(EM_SUPPORTED).putUInt8(EM_PREFERRED)
  enc.putUInt8(padLength).putBuffer(crypt.randBuf(padLength))
  enc = crypt.RC4Crypt(enc, enc.length, _this.sendKey)

  buf.putUInt8(crypt.randProtocol()).putUInt32LE(randomKey).putBuffer(enc)

  _this.crypt.status = CS_NEGOTIATING
  _this.handshakeTimeout = setTimeout(function() {
    _this._timeout('handshake')
  }, conf.tcp.connectionTimeout)
  _this.socket.write(buf, function(err) {
    if (err) {
      _this._error(err)
    }
  })
}

Client.prototype._decrypt = function(data) {
  var _this = this
  switch (t.crypt.status) {

    case CS_ENCRYPTING:
      log.trace('Client._decrypt: Decrypting')
      data = crypt.RC4Crypt(data, data.length, _this.recvKey)
      break

    case CS_NEGOTIATING:
      data = crypt.RC4Crypt(data, data.length, _this.recvKey)
      if (data.getUInt32LE() == MAGICVALUE_SYNC) {
        clearTimeout(this.handshakeTimeout)
        log.trace('Client._decrypt: Negotiation response Ok.')
        _this.crypt.method = data.getUInt8() // should be == EM_OBFUSCATE
        data.get(data.getUInt8()) // skip padding
        _this.crypt.status = CS_ENCRYPTING
        if (data.pos() < data.length) {
          log.warn('Client._decrypt: there is more unhandled data!')
          misc.hexDump(data.get())
        }
        _this._handshake(false)
        return false
      }
      else {
        _this.crypt.status = CS_NONE
        _this._handshake({message: 'Bad handshake answer received'})
      }
      return data

    case CS_NONE:
      return data

    case CS_UNKNOWN:
    default:
      log.error('Client._decrypt: We souldn\'t be here')
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
      var d = data.get(size)
      var opcode = d.getUInt8()
      switch (opcode) {
        case OP_HELLOANSWER:
          clearTimeout(t.opHelloTimeout)
          _this._opHello(readOpHelloAnswer(d))
          break
        default: log.warn('eD2K CLient: Unhandled opcode: 0x'+opcode.toString(16))
      }
    }
    else {
      log.error('eD2K Client: incoming data: bad protocol: 0x'+protocol.toString(16))
    }
  })

  this.socket.on('error', function(err) {
    _this._error(err)
  })

  this.socket.setTimeout(conf.tcp.connectionTimeout, function() {
    _this._timeout('connection')
  })

  this.socket.connect({port: port, host: host, localAddress: conf.address }, function() {
    _this._connected()
  })

  return this
}

Client.prototype.on = function(event, callback) {
  switch (event) {
    case 'error':
      this._error = callback
      break
    case 'timeout':
      this._timeout = callback
      break
    case 'connected':
      this._connected = callback
      break
    case 'data':
      this._data = callback
      break
    case 'opHelloAnswer':
      this._opHello = callback
      break
    case 'handshake':
      this._handshake = callback
      break
  }
  return this
}

Client.prototype.send = function(operation, info, callback) {
  var pack = [[TYPE_UINT8, operation]],
    _this = this
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
        _this._timeout('hello')
      }, conf.tcp.connectionTimeout)
      _this.socket.write(Packet.make(PR_ED2K, pack), callback)
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
  info.tags = data.getTags()
  info.serverAddress = data.getUInt32LE()
  info.serverPort = data.getUInt16LE()
  if (data.pos() < data.length) {
    log.warn('readOpHelloAnswer Excess: '+log.get().toString('hex'))
  }
  return info
}
