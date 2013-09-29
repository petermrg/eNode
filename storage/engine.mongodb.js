var mongo = require('mongodb')
var log = require('tinylogger')
var misc = require('../ed2k/misc.js')
var conf = require('../enode.config.js').storage.mongodb

/**
 * MongoDB Storage engine
 *
 * Documentation: http://mongodb.github.com/node-mongodb-native/
 */

// Collections
var coll = {
  users: null,
  files: null,
  sources: null,
  servers: null,
}

var dbOptions = {
  w: 1,
  auto_reconnect: true,
  poolSize: 8,
  native_parser: true,
}

/**
 * Default error handler
 */
var mongoErr = function(err) {
  if (err) {
    log.error('MongoDB: '+err)
    console.trace();
  }
}

/**
 * Initiates the database connection.
 * - Sets all clients online status to 0
 * - Sets all files online status to 0
 *
 * @param {Function} callback() The callback function when init ends.
 */
exports.init = function(callback) {
  log.info('MongoDB init...')

  var db = new mongo.Db(
    conf.database,
    new mongo.Server(conf.host, conf.port, {}),
    dbOptions
  )

  db.open(function(err, db) {
    if (err) {
      log.panic('MongoDB init: Cannot connect to database. '+err)
      process.exit()
    }
    log.info('MongoDB init: database "'+conf.database+'" opened')

    // create collections
    var options = {
      fsync: true,
    }

    db.createCollection('clients', options, function(err, collection) {
      mongoErr(err)
      coll.clients = collection
      coll.clients.update({}, {'$set': {'online': 0}}, {'multi': 1}, mongoErr)
    })

    db.createCollection('files', options, function(err, collection) {
      mongoErr(err)
      coll.files = collection
      files.getCount(true, function(){})
      coll.files.ensureIndex({
        'name': 1,
        'hash': 1,
        'size': 1,
        'online': 1,
        'complete': 1,
        'time_offer': 1,
      }, mongoErr)
      coll.files.update({}, {'$set': {'online': 0}}, {'multi': 1}, mongoErr)
    })

    db.createCollection('servers', options, function(err, collection) {
      mongoErr(err)
      coll.servers = collection
      callback()
    })

    setInterval(function(){
      files.getCount(true, function(){})
    }, 5000*60)

  })

}

var clients = {

  _count: 0,

  getCount: function(force) {
    return clients._count
  },

  /**
   * Checks if given client is connected
   *
   * @param {Object} clientInfo
   * @param {Function} callback(err, data)
   */
  isConnected: function(clientInfo, callback) {
    var id = clientInfo.hash.toString('hex')
    coll.clients.findOne({'_id': id, online: 1}, function(err, data) {
      mongoErr(err)
      if (data) {
        callback(err, true)
        log.trace('clients.isConnected: yes')
      }
      else {
        callback(err, false)
        log.trace('clients.isConnected: no')
      }
    })
  },

  /**
   * Saves/updates user information in database and sets client online
   * status to 1
   *
   * @param {Object} clientInfo Client connection information
   * @param {Buffer} clientInfo.hash
   * @param {Integer} clientInfo.id
   * @param {Integer} clientInfo.ipv4
   * @param {Integer} clientInfo.port
   * @param {Function} callback(err, storageId)
   */
  connect: function(clientInfo, callback) {
    var id = clientInfo.hash.toString('hex')
    var data = {
      'id_ed2k': clientInfo.id,
      'ipv4': clientInfo.ipv4,
      'port': clientInfo.port,
      'online': 1,
      'time_connected': misc.unixTimestamp(),
    }
    var key = {
      _id: id,
    }
    var options = {
      upsert: true,
    }

    coll.clients.update(key, { '$set': data }, options, function(err) {
      mongoErr(err)
      clients.count++
      callback(false, id)
      log.trace('MongoDB: client.connect')
      console.dir(data)
    })

  },

  /**
   * Disconnect client
   * Sets client and client files online status to 0
   *
   * @param {Object} clientInfo Client connection information
   * @param {Integer} clientInfo.storageId
   */
  disconnect: function(clientInfo) {
    var key = { _id: clientInfo.storageId }
    var data = { online: 0 }
    var options = { upsert: false }

    // set client online status to 0
    coll.clients.update(key, { '$set': data }, options, function(err) {
      log.trace('MongoDB client.disconnect: set client offline')
      mongoErr(err)
      clients.count--
    })

    // set client files online status to 0
    options.multi = true;
    key = { id_client: clientInfo.storageId }
    coll.files.update(key, {'$set': data}, options, function(err, num) {
      log.trace('MongoDB client.disconnect: set '+num+' files offline')
      mongoErr(err)
    })
  },

}

var files = {

  _count: 0,

  /**
   * Gets the total number of sources in database
   * If called without parameters, returns the cached file count number
   * If force parameter == true then the count is queried to database and
   * returned as callback parameter
   *
   * @param {Boolean} force
   * @param {Function} callback(err, count)
   * @returns {Integer} stored count
   */
  getCount: function(force, callback) {
    if (force) {
      coll.files.find({}).count(function(err, count) {
        files._count = count
        log.trace('MongoDB: files count: '+count)
        if (misc.isFunction(callback)) callback(err, count)
      })
    }
    return files._count
  },

  /**
   * Adds source to database
   *
   * @param {Object} file
   * @param {Object} clientInfo
   * FIXME: this function sould be called addSource to be more consistent
   */
  addSource: function(file, clientInfo) {
    if (!file.type) file.type = misc.getFileType(file.name)
    var data = {
      hash: file.hash,
      size: file.size,
      online: 1,
      complete: file.complete,
      name: file.name,
      ext: misc.ext(file.name),
      time_offer: misc.unixTimestamp(),
      id_client: clientInfo.storageId,
      id: clientInfo.id,
      port: clientInfo.port,
    }
    var key = {
      hash: file.hash,
      id_client: clientInfo.storageId,
    }
    var options = {
      upsert: true,
    }
    if (file.codec) data.codec = file.codec
    if (file.type) data.type = file.type
    if (file.rating) data.rating = file.rating
    if (file.title) data.title = file.title
    if (file.artist) data.artist = file.artist
    if (file.album) data.album = file.album
    if (file.bitrate) data.bitrate = file.bitrate
    if (file.length) data.length = file.length
    coll.files.update(key, data, options, mongoErr)
  },

  getSources: function(fileHash, fileSize, callback) {
    log.trace('MongoDB: client.getSources: '+
      fileHash.toString('hex')+' '+fileSize)
    var keys = {
      hash: fileHash,
      size: fileSize,
    }
    var fields = {
      _id: false,
      id: true,
      port: true,
    }
    var options = {
      sort: [
        ['online', 'desc'],
        ['complete', 'desc'],
        ['time_offer', 'desc'],
      ],
      limit: 255,
    }
    coll.files.find(keys, fields, options, function(err, data) {
      data.toArray(function(err, sources) {
        console.log(sources)
        callback(fileHash, sources)
      })
    })
  },

  getSourcesByHash: function(fileHash, callback) {
    log.info('getSourcesByHash')
  },

  find: function(data, callback) {
    log.info('find')
    var s = data.getSearchString();
    log.trace('MongoDB: getSearchString: ')
    console.dir(s)
  },
}

var servers = {

  _count: 0,

  getCount: function() {
    return servers._count
    log.info('count')
  },

  add: function() { log.info('add') },
  all: function() { log.info('all') },
}

var likes = function(text) {
  var r = [];
  text.split(' ').forEach(function(v){
    if (v != ' ') {
      r.push("s.name LIKE "+('%'+v+'%'));
    }
  });
  return r.join(' && ');
}

var searchExpr = function(token, type, value) {
  switch (type) {
    case 0xff: return likes(value)
    case 0x00: return " && "
    case 0x01: return " || "
    case 0x02: return " && !"
    case 0x030001: return "s.type="+(value)
    case 0x040001: return "s.ext="+(value)
    case 0xd50001: return "s.codec="+(value)
    case 0x02000101: return "f.size>"+(value)
    case 0x02000102: return "f.size<"+(value)
    case 0x15000101: return "f.sources>"+(value)
    case 0xd4000101: return "s.bitrate>"+(value)
    case 0xd3000101: return "s.duration>"+(value)
    case 0x30000101: return "f.completed>"+(value)
    default: log.warn('searchExpr: unknown type: 0x'+
      type.toString(16)+' - token: 0x'+token.toString(16)+' value: '+value)
  }
}
/*
db.test.find({$or:
    [
      { name: /star/i, name: { $not: /trek/i } },
      { duration: 200 }
    ]
  },{_id:0})

*/
Buffer.prototype.getSearchString = function() {
  var token = this.getUInt8()
  switch (token) {
    case 0x01: // text match
      return searchExpr(token, 0xff, this.getString())
    case TYPE_STRING: // string
      var value = this.getString()
      var type = this.getUInt8()
      type+= this.getUInt16LE() * 0x100
      return searchExpr(token, type, value)
    case TYPE_UINT32: // 32bit value
      var value = this.getUInt32LE()
      var type = this.getUInt32LE()
      return searchExpr(token, type, value)
    case 0x08: // 64bit value
      var value = this.getUInt64LE()
      var type = this.getUInt32LE()
      return searchExpr(token, type, value)
    case 0x00: // tree node
      var type = this.getUInt8()
      var s = '(' + this.getSearchString()
      s+= searchExpr(token, type, null)
      s+= this.getSearchString() + ')'
      return s
    default:
      log.warn('Buffer.getSearchString: unknown token: 0x'+token.toString(16))
  }
  return ''
}

exports.clients = clients
exports.files   = files
exports.servers = servers
