var conf = require('../enode.config.js').config
var log = require('tinylogger')
var db = require('../storage/storage.js')
var net = require('net')
var lowIdClients = require('./lowidclients.js').lowIdClients
var Packet = require('./packet.js').Packet
var zlib = require('zlib')
var misc = require('./misc.js')
var crypt = require('./crypt.js')
var eD2KClient = require('./client.js').Client

/**
 * Checks if a client is firewalled
 *
 * @param {Socket} client
 * @param {Object} client.info Client information
 * @param {Integer} client.info.port Port to check
 * @param {Function} callback(isFirewalled) Callback argument is boolean. True if firewalled.
 */
var isFirewalled = function(client, crypted, callback) {
  log.info('Checking if firewalled')
  var testClient = new eD2KClient()

  testClient.on('connected', function() {
    if (crypted) {
      log.debug('HANDSHAKE > '+client.remoteAddress)
      testClient.handshake(client.info.hash)
    }
    else {
      log.debug('OP_HELLO > '+client.remoteAddress+':'+client.info.port)
      testClient.send(OP_HELLO, null, function(err) {})
    }
  })

  testClient.on('error', function(err) {
    log.error(err)
    testClient.end()
    callback(true)
  })

  testClient.on('timeout', function(from) {
    log.trace('isFirewalled got timeout from: '+from)
    switch (from) {
      case 'connection':
      case 'hello':
        testClient.end()
        callback(true)
        break
      case 'handshake':
        testClient.end()
        isFirewalled(client, false, callback)
        break
    }
  })

  testClient.on('handshake', function(err) {
    if (err == false) {
      testClient.end()
      callback(false)
    }
    // else do nothing because we will get a handshake timeout
  })

  testClient.on('opHelloAnswer', function(info) {
    log.info('Received hello answer!')
    testClient.end()
    //console.dir(info)
    callback(false)
  })

  testClient.connect(client.remoteAddress, client.info.port, client.info.hash)
}

/**
 * Processes incoming TCP data
 *
 * @param {Buffer} data Incoming data
 * @param {Socket} client The client who sends the data
 * @param {Packet} client.packet Packet object from client
 */
var processData = function(data, client) {
  // process incoming data
  switch (client.packet.status) {
    case PS_NEW:
      //log.trace('tcpops.processData: New')
      client.packet.init(data)
      break
    case PS_WAITING_DATA:
      //log.trace('tcpops.processData: Waiting data...')
      client.packet.append(data)
      break
    case PS_CRYPT_NEGOTIATING:
      //log.trace('tcpops.processData: Negotiation response')
      client.crypt.process(data)
      break
    default:
      //log.error('tcpops.processData 1: unexpected Packet Status')
      console.dir(client.packet)
      return
  }
  // execute action
  switch (client.packet.status) {
    case PS_READY:
      parse(client.packet)
      break
    default:
  }
}
exports.processData = processData

/**
 * Parses a clients packet and depending on it's header takes action
 *
 * @param {Socket} client
 * @param {Packet} client.packet Packet object from client
 */
var parse = function(packet) {
  //log.trace('TCP op.receive.parse')
  //log.trace(client.info)
  switch (packet.protocol) {
    case PR_ED2K:
      ed2k(packet.client)
      break
    case PR_ZLIB:
      zlib.unzip(packet.data, function(err, buffer) {
        if (!err) {
          packet.data = buffer
          ed2k(packet.client)
        }
        else {
          log.error('Cannot unzip: operation 0x'+packet.code.toString(16))
        }
      })
      break
    case PR_EMULE:
      log.warn('TCP: Unsupported protocol: PR_EMULE (0x'+
        packet.protocol.toString(16)+')')
      break
    default:
      log.warn('TCP: Unknown protocol: 0x'+packet.protocol.toString(16))
      misc.hexDump(buffer)
      // if (this.packet.crypt.status == CS_NONE) {
      //   log.warn('Encription is disabled!')
      // }
      // else if (this.packet.crypt.status == CS_UNKNOWN) {
      //   log.info('Incoming possible obfuscated data. Start negotiation.')
      //   this.packet.crypt.init(packet.data.get())
      // }
  }
  packet.status = PS_NEW
  if (packet.hasExcess) {
    processData(packet.excess, packet.client)
  }
}

/**
 * Error handler for socket.write operations
 *
 * @param err Information about the error or false if there isn't.
 */
var writeError = function(err) {
  if (err) { log.error('Socket write error: '+JSON.stringify(err)) }
}

/**
 * Executes an eD2K operation
 *
 * @param {net.Socket} client
 * @param {Packet} client.packet
 */
var ed2k = function(client) {
  client.packet.data.pos(0)
  switch (client.packet.code) {
    case OP_LOGINREQUEST:
      receive.loginRequest(client)
      break
    case OP_OFFERFILES:
      receive.offerFiles(client)
      break
    case OP_GETSERVERLIST:
      receive.getServerList(client)
      break
    case OP_GETSOURCES_OBFU:
    case OP_GETSOURCES:
      receive.getSources(client)
      break
    case OP_SEARCHREQUEST:
      receive.searchRequest(client)
      break
    case OP_CALLBACKREQUEST:
      receive.callbackRequest(client)
      break
    default:
      log.warn('ed2k: Unhandled opcode: 0x'+client.packet.code.toString(16))

  }
}

var receive = {

  handShake: function(client) {
    db.clients.connect(client.info, function(err, storageId) {
      if (!err) {
        client.info.logged = true
        log.info('Storage ID: '+storageId)
        client.info.storageId = storageId
        send.serverMessage(conf.messageLogin, client)
        send.serverMessage('server version '+ENODE_VERSIONSTR+' ('+ENODE_NAME+')', client)
        send.serverStatus(client)
        send.idChange(client.info.id, client)
        send.serverIdent(client)
      }
      else {
        log.error(err)
        //send.serverMessage(clientStorage.message, client)
        log.todo('handShake: send reject command')
        //client.end()
      }
    })
  },

  loginRequest: function(client) {
    log.debug('LOGINREQUEST < '+client.info.ipv4)
    var data = client.packet.data
    client.info.hash = data.get(16)
    client.info.id = data.getUInt32LE()
    client.info.port = data.getUInt16LE()
    client.info.tags = data.getTags()
    db.clients.isConnected(client.info, function(err, connected) {
      if (err) {
        log.error('loginRequest: '+err)
        client.end()
        return
      }
      if (connected) {
        log.error('loginRequest: already connected')
        client.end()
        return
      }
      isFirewalled(client, conf.supportCrypt, function(firewalled) {
        if (firewalled) {
          client.info.hasLowId = true
          send.serverMessage(conf.messageLowID, client)
          client.info.id = lowIdClients.add(client)
          if (client.info.id != false) {
            receive.handShake(client)
            log.info('Assign LowId: '+client.info.id)
          }
          else { client.end() }
        }
        else {
          client.info.hasLowId = false
          client.info.id = client.info.ipv4
          client.info.hasLowId = false
          receive.handShake(client)
          log.info('Assign HighID: '+client.info.id)
        }
      })
    })
  },

  offerFiles: function(client) {
    log.debug('OFFERFILES < '+client.info.storageId)
    var count = client.packet.data.getFileList(function(file) {
      //log.trace(file.name+' '+file.size+' '+file.hash.toString('hex'))
      db.files.add(file, client.info)
    })
    log.trace('Got '+count+' files from '+client.remoteAddress+
      ' Total files: '+db.files.count())
  },

  getServerList: function(client) {
    log.debug('GETSERVERLIST < '+client.info.storageId)
    send.serverList(client)
    send.serverIdent(client)
  },

  getSources: function(client) {
    log.debug('GETSOURCES < '+client.info.storageId)
    var file = {
      hash: client.packet.data.get(16),
      size: client.packet.data.getUInt32LE(),
      sizehi: 0,
    }
    if (file.size == 0) { // large file, read 64bits
      file.size = client.packet.data.getUInt32LE()
      file.size+= client.packet.data.getUInt32LE() * 0x100000000
    }
    db.files.getSources(file.hash, file.size, function(fileHash, sources) {
      log.trace('Got '+sources.length+' sources for file: '+fileHash.toString('hex'))
      send.foundSources(fileHash, sources, client)
    })
  },

  searchRequest: function(client) {
    log.info('SEARCHREQUEST < '+client.info.storageId)
    //log.text(hexDump(client.packet.data))
    db.files.find(client.packet.data, function(files) {
      send.searchResult(files, client)
    })
  },

//
// Client A (High ID)    Server          Client B (Low ID)
//  |>---CallbackRequest---->|              |
//  |            |>---CallbackRequested---->|
//  |<----------------------------------Connect--------<|
//  :            :              :
//  |<----CallbackFailed----<|              |

  callbackRequest: function(client) {
    log.info('CALLBACKREQUEST < '+client.info.storageId)
    var lowId = client.packet.data.getUInt32LE() // properties are hex strings
    clientWithLowId = lowIdClients.get(lowId)
    if (clientWithLowId != false) {
      send.callbackRequested(clientWithLowId, client)
    }
    else {
      log.debug('CallbackRequest failed: LowId client is not connected')
      send.callbackFailed(client)
    }
  },

}

var submit = function(data, client, errCallback) {
  if (client.crypt.status == CS_ENCRYPTING) {
    //log.trace('*** Encrypting packet')
    data = crypt.RC4Crypt(data, data.length, client.crypt.sendKey)
  }
  if (errCallback == undefined) { errCallback = writeError }
  client.write(data, errCallback)
}

var send = {

  foundSources: function(fileHash, sources, client) {
    log.debug('FOUNDSOURCES > '+client.info.storageId)
    log.todo('OP_FOUNDSOURCES_OBFU: add client crypt info. See PartFile.cpp CPartFile::AddSources')
    var pack = [
      [TYPE_UINT8, OP_FOUNDSOURCES],
      [TYPE_HASH, fileHash],
      [TYPE_UINT8, sources.length]
    ]
    sources.forEach(function(src) {
      pack.push([TYPE_UINT32, src.id])
      pack.push([TYPE_UINT16, src.port])
    })
    submit(Packet.make(PR_ED2K, pack), client)
  },

  searchResult: function(files, client) {
    log.debug('SEARCHRESULT > '+client.info.storageId)
    var pack = [
      [TYPE_UINT8, OP_SEARCHRESULT],
      [TYPE_UINT32, files.length]
    ]
    files.forEach(function(file) {
      Packet.addFile(pack, file)
    })
    submit(Packet.make(PR_ED2K, pack), client)
  },

  serverList: function(client) {
    log.debug('SERVERLIST > '+client.info.storageId)
    var pack = [
      [TYPE_UINT8, OP_SERVERLIST],
      [TYPE_UINT8, db.servers.count()],
    ]
    db.servers.all().forEach(function(v) {
      log.trace(v.ip+':'+v.port)
      pack.push([TYPE_UINT32, misc.IPv4toInt32LE(v.ip)])
      pack.push([TYPE_UINT16, v.port])
    })
    submit(Packet.make(PR_ED2K, pack), client)
  },

  serverStatus: function(client) {
    log.debug('SERVERSTATUS > '+client.info.storageId+' clients: '+db.clients.count()+
      ' files: '+db.files.count())
    var pack = [
      [TYPE_UINT8, OP_SERVERSTATUS],
      [TYPE_UINT32, db.clients.count()],
      [TYPE_UINT32, db.files.count()]
    ]
    submit(Packet.make(PR_ED2K, pack), client)
  },

  idChange: function(id, client) {
    log.debug('IDCHANGE > '+client.info.storageId+' id: '+id)
    var pack = [
      [TYPE_UINT8, OP_IDCHANGE],
      [TYPE_UINT32, id],
      [TYPE_UINT32, conf.tcp.flags]
    ]
    submit(Packet.make(PR_ED2K, pack), client)
  },

  callbackFailed: function(client) {
    log.debug('CALLBACKFAILED > '+client.info.storageId+' id: '+id)
    var pack = [[TYPE_UINT8, OP_CALLBACKFAILED]]
    submit(Packet.make(PR_ED2K, pack), client)
  },

  serverIdent: function(client) {
    log.debug('SERVERIDENT > '+client.info.storageId)
    var pack = [
      [TYPE_UINT8, OP_SERVERIDENT],
      [TYPE_HASH, conf.hash],
      [TYPE_UINT32, misc.IPv4toInt32LE(conf.address)],
      [TYPE_UINT16, conf.tcp.port],
      [TYPE_TAGS, [
        [TYPE_STRING, TAG_SERVER_NAME, conf.name],
        [TYPE_STRING, TAG_SERVER_DESC, conf.description]
      ]],
    ]
    submit(Packet.make(PR_ED2K, pack), client)
  },

  serverMessage: function(message, client) {
    log.debug('SERVERMESSAGE > '+client.info.storageId+' '+message)
    var pack = [
      [TYPE_UINT8, OP_SERVERMESSAGE],
      [TYPE_STRING, message.toString()],
    ]
    submit(Packet.make(PR_ED2K, pack), client)
  },

  callbackRequested: function(clientWithLowId, client) { // TODO: TEST
    log.info('CALLBACKREQUESTED > '+clientWithLowId.info.id)
    var pack = [
      [TYPE_UINT8, OP_CALLBACKREQUESTED],
      [TYPE_UINT32, client.info.ipv4],
      [TYPE_UINT16, client.info.port],
    ]
    submit(Packet.make(PR_ED2K, pack), clientWithLowId, function(err) {
      if (err) {
        writeError(err)
        send.callbackFailed(client)
      }
    })
  },

}

