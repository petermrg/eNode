var mysql = require('mysql'), // https://github.com/felixge/node-mysql
  log = require('tinylogger'),
  misc = require('../ed2k/misc.js'),
  conf = require('../enode.config.js').config.storage.mysql;

var sql = {

  connections: [],
  current: 0,
  connectionsCount: 0,

  defErr: function(err, sender) { // default error handler
    sender = sender ? (sender+': ') : '';
    if (!err) return;
    log.error(JSON.stringify(err));
    if (err.fatal) {
      log.panic(sender+'MySQL '+err);
      process.exit();
    }
    else log.error(sender+'MySQL '+err);
    return false;
  },

  esc: function(value) { return sql.connections[sql.current].escape(value); },

  query: function(str, values, callback) {
    if (callback == undefined) { callback = sql.defErr; }
    var q = sql.connections[sql.current].query(str, values, function(err, rows) {
      if (err && err.code == 'ER_LOCK_DEADLOCK') {
        log.warn('Deadlock detected. Query: '+str);
        setTimeout(function() {
            sql.query(str, values, callback);
        }, conf.deadlockDelay);
        return;
      }
      callback(err, rows);
    });
    if (conf.log) {
      log.sql('['+sql.current+'] '+(conf.fullLog ? q.sql : q.sql.substring(0,80)));
    }
    sql.current = (sql.current+1) % sql.connectionsCount; // round robin
  },

  setErrorListener: function(sqlConnection) {
    sqlConnection.on('error', function(err) {
      if (err.code == 'PROTOCOL_CONNECTION_LOST') {
        log.warn(JSON.stringify(err));
        log.warn('MySQL connection Lost. Re-connecting.');
        sqlConnection = mysql.createConnection(sqlConnection.config);
        sql.setErrorListener(sqlConnection);
        sqlConnection.connect();
      }
      else {
        sql.defErr(err, 'ErrorListener');
      }
    });
  },

}

exports.init = function(callback) {
  for (var i=0; i<conf.connections; i++) {
    sql.connections[i] = mysql.createConnection({
      host: conf.host,
      user: conf.user,
      password: conf.pass,
      database: conf.database,
      supportBigNumbers: true,
    });
    sql.connections[i].connect(function(err){
      sql.connectionsCount++;
      if (err) { return sql.defErr(err); }
      if (sql.connectionsCount == conf.connections) { // last connection?
        log.ok('Connected to MySQL server ('+conf.connections+' connections): '+conf.user+'@'+conf.host+'/'+conf.database);
        sql.query('UPDATE clients SET online = 0', function(err){
          if (err) { return sql.defErr(err); }
          sql.query('UPDATE sources SET online = 0', function(err){
            if (err) { return sql.defErr(err); }
            files.updateCount();
            callback();
          });
        });
      }
    });
    sql.setErrorListener(sql.connections[i]);
  }
};

clients = {

  count: 0,

  /**
   * @param {Object} clientInfo Client connection information
   * @param {Buffer} clientInfo.hash Hash value reported on connection
   * @param {Function(err, connected)} callback
   * @returns undefined
   **/
  isConnected: function(clientInfo, callback) {
    sql.query('SELECT id FROM clients WHERE hash = ? AND online = 1 LIMIT 1', [clientInfo.hash], function(err, rows){
      if (err) {
        callback(err);
        return;
      }
      if (rows.length > 0) {
        callback(false, true);
        return;
      }
      callback(false, false);
    });
  },

  /**
   * @param {Object} clientInfo Client connection information
   * @param {Buffer} clientInfo.hash
   * @param {Integer} clientInfo.id
   * @param {Integer} clientInfo.ipv4
   * @param {Integer} clientInfo.port
   * @param {Function} callback(err, storageId)
   * @returns undefined
   **/
  connect: function(clientInfo, callback) {
    var v = {
      hash: clientInfo.hash,
      id_ed2k: clientInfo.id,
      ipv4: clientInfo.ipv4,
      port: clientInfo.port,
      online: 1,
    };
    sql.query('INSERT INTO clients SET ? ON DUPLICATE KEY UPDATE ? ', [v,v], function(err){
      if (err) { callback(err); return; }
      sql.query('SELECT id FROM clients WHERE hash = ? LIMIT 1', [clientInfo.hash], function(err, rows){

        if (err) { callback(err); return; }
        if (rows.length < 1) {
          callback('MySQL clients.connect: Error inserting client');
          return;
        }
        clients.count++;
        callback(false, rows[0].id);
      });
    });
  },

  /**
   * @description Sets online status of client and client's file to 0
   * @param {Object} clientInfo Client connection information
   * @param {Integer} clientInfo.storageId
   * @param {Boolean} clientInfo.logged
   * @returns undefined
   **/
  disconnect: function(clientInfo) { // when a user disconnects, set his online status to 0
    if (clientInfo.logged) {
      clientInfo.logged = false;
      log.info('client.disconnect: '+(clientInfo.storageId));
      sql.query('UPDATE clients SET online = 0 WHERE id = ?', [clientInfo.storageId]);
      sql.query('UPDATE sources SET online = 0 WHERE id_client = ?', [clientInfo.storageId]);
      log.todo('client.disconnect: Update client\'s files values for sources and completed ??');
      clients.count--;
    }
  },

  getById: function(clientId, callback) {
    sql.query('SELECT * FROM clients WHERE id_ed2k = ? LIMIT 1', [clientId], function(err, client){
      if (err) { return sql.defErr(err) }
      callback(client);
    });
  },

};

var files = {

  count: 0,

  get: function(fileHash, fileSize, callback) {
    sql.query('SELECT id FROM files WHERE hash = ? AND size = ? LIMIT 1', [fileHash, fileSize], function(err, files){
      if (err) { return sql.defErr(err) }
      if (files.length > 0) { callback(files[0].id); }
      else { callback(false); }
    });
  },

  getByHash: function(fileHash, callback) {
    sql.query('SELECT id FROM files WHERE hash = ? LIMIT 1', [fileHash], function(err, files){
      if (err) { return sql.defErr(err) }
      if (files.length > 0) { callback(files[0].id); }
      else { callback(false); }
    });
  },

  add: function(file, clientInfo) {
    sql.current = clientInfo.id % sql.connectionsCount;
    sql.query('INSERT INTO files SET time_offer=NOW(), ? ON DUPLICATE KEY UPDATE time_offer=NOW()', {hash: file.hash, size: file.size}, function(err){
      if (err) { return sql.defErr(err); }
      sql.current = clientInfo.id % sql.connectionsCount;
      files.get(file.hash, file.size, function(fileId) {
        if (fileId == false) {
          log.error('files.add: File not found after insert: '+file.hash.toString('hex'));
          return;
        }
        file.id = fileId;
        files.addSource(file, clientInfo);
      });
    });
  },

  addSource: function(file, clientInfo) {
    if (!file.type) { file.type = misc.getFileType(file.name); }
    var v = {
      id_file: file.id, id_client: clientInfo.storageId, online: 1,
      complete: file.complete, name: file.name, ext: misc.ext(file.name),
    };
    if (file.codec) v.codec = file.codec;
    if (file.type) v.type = file.type;
    if (file.rating) v.rating = file.rating;
    if (file.title) v.title = file.title;
    if (file.artist) v.artist = file.artist;
    if (file.album) v.album = file.album;
    if (file.bitrate) v.bitrate = file.bitrate;
    if (file.length) v.length = file.length;
    sql.current = clientInfo.id % sql.connectionsCount;
    sql.query('INSERT INTO sources SET ?, time_offer = NOW() ON DUPLICATE KEY UPDATE ?, time_offer = NOW()', [v,v], function(err){
      if (err) { return sql.defErr(err, 'files.addSource (insert)'); }
      sql.current = clientInfo.id % sql.connectionsCount;
      sql.query('UPDATE files AS f '+
        'LEFT JOIN (SELECT id_file, SUM(complete) AS c, COUNT(*) AS s FROM sources GROUP BY id_file) AS c ON f.id = c.id_file '+
        'SET f.completed = c.c, f.sources = c.s, source_id = ?, source_port = ?', [clientInfo.id, clientInfo.port], function(err){
        if (err) { return sql.defErr(err, 'files.addSource (update)'); }
      });
    });
  },

  getSources: function(fileHash, fileSize, callback) {
    files.get(fileHash, fileSize, function(fileId){
      if (fileId != false) {
        var q = 'SELECT c.id_ed2k AS id, c.port '+
          'FROM sources AS s '+
          'INNER JOIN clients AS c ON c.id = s.id_client '+
          'WHERE s.id_file = ? '+
          'ORDER BY s.online DESC, s.time_offer DESC '+
          'LIMIT 255';
        sql.query(q, [fileId], function(err, sources){
          if (err) { return sql.defErr(err); }
          callback(fileHash, sources);
        });
      }
      else { callback(fileHash, []); }
    });
  },

  getSourcesByHash: function(fileHash, callback) {
    files.getByHash(fileHash, function(fileId){
      if (fileId != false) {
        var q = 'SELECT c.id_ed2k AS id, c.port '+
          'FROM sources AS s '+
          'INNER JOIN clients AS c ON c.id = s.id_client '+
          'WHERE s.id_file = ? '+
          'ORDER BY s.online DESC, s.time_offer DESC '+
          'LIMIT 255';
        sql.query(q, [fileId], function(err, sources){
          if (err) { return sql.defErr(err); }
          callback(fileHash, sources);
        });
      }
      else { callback(fileHash, []); }
    });
  },

  updateCount: function() {
    sql.query('SELECT COUNT(*) AS c FROM files', function(err, row){ //  WHERE complete = 1 ?
      files.count = row[0]['c'];
      log.trace('Files count: '+files.count);
    });
  },

  find: function(data, callback) {
    try {
      var where = data.getSearchString();
      var t = Math.floor(Math.random()*1000000);
      var t = new Date().getTime();
      var q = "SELECT s.name, f.completed, f.sources, f.hash, f.size, f.source_id, f.source_port, "+
        "s.type, s.title, s.artist, s.album, s.length AS runtime, s.bitrate, s.codec "+
        "FROM sources AS s "+
        "INNER JOIN files AS f ON s.id_file = f.id "+
        "INNER JOIN clients AS c ON s.id_client = c.id "+
        "WHERE "+where+" "+
        "GROUP BY s.id_file "+
        "LIMIT 255";
      sql.query(q, function(err, sources){
        log.sql('Time: '+((new Date().getTime()-t) / 1000)+'s');
        if (err) throw(err);
        if (sources.count < 1) { callback([]); }
        callback(sources);
      });
    } catch (err) {
      sql.defErr(err, 'files.find');
      callback([]);
    }
  },

};

var servers = {

  count: 2,

  list: [
    { ip: '111.222.111.222', port: 1234 },
    { ip: '123.123.234.234', port: 2345 },
  ],

  all: function() {
    return servers.list;
  },

};

var likes = function(text) {
  var r = [];
  text.split(' ').forEach(function(v){
    if (v != ' ') {
      r.push("s.name LIKE "+sql.esc('%'+v+'%'));
    }
  });
  return r.join(' AND ');
}

var searchExpr = function(token, type, value) {
  switch (type) {
    case 0xff: return likes(value);
    case 0x00: return " AND ";
    case 0x01: return " OR ";
    case 0x02: return " AND NOT ";
    case 0x030001: return "s.type="+sql.esc(value);
    case 0x040001: return "s.ext="+sql.esc(value);
    case 0xd50001: return "s.codec="+sql.esc(value);
    case 0x02000101: return "f.size>"+sql.esc(value);
    case 0x02000102: return "f.size<"+sql.esc(value);
    case 0x15000101: return "f.sources>"+sql.esc(value);
    case 0xd4000101: return "s.bitrate>"+sql.esc(value);
    case 0xd3000101: return "s.duration>"+sql.esc(value);
    case 0x30000101: return "f.completed>"+sql.esc(value);
    default: log.warn('searchExpr: unknown type: 0x'+type.toString(16)+'; token: 0x'+token.toString(16)+'; value: '+value);
  }
}

Buffer.prototype.getSearchString = function() {
  var token = this.getUInt8();
  switch (token) {
    case 0x01: // text match
      return searchExpr(token, 0xff, this.getString());
    case TYPE_STRING: // string
      var value = this.getString();
      var type = this.getUInt8();
      type+= this.getUInt16LE() * 0x100;
      return searchExpr(token, type, value);
    case TYPE_UINT32: // 32bit value
      var value = this.getUInt32LE();
      var type = this.getUInt32LE();
      return searchExpr(token, type, value);
    case 0x08: // 64bit value
      var value = this.getUInt32LE();
      value+= this.getUInt32LE() * 0x10000 * 0x10000;
      var type = this.getUInt32LE();
      return searchExpr(token, type, value);
    case 0x00: // tree node
      var type = this.getUInt8();
      var s = '(' + this.getSearchString();
      s+= searchExpr(token, type, null);
      return s + this.getSearchString() + ')';
    default:
      log.warn('Buffer.getSearchString: unknown token: 0x'+token.toString(16));
  }
  return '';
}; // http://en.wikipedia.org/wiki/Binary_expression_tree

exports.clients = clients;
exports.files   = files;
exports.servers = servers;
