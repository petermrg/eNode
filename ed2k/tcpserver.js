var net = require('net'),
    log = require('tinylogger'),
    db = require('../storage/storage.js'),
    misc = require('./misc.js'),
    crypt = require('./crypt.js'),
    Packet = require('./packet.js').Packet,
    TcpCrypt = require('./tcpcrypt.js').TcpCrypt,
    conf = require('../enode.config.js').config,
    lowIdClients = require('./lowidclients.js').lowIdClients,
    op = require('./tcpoperations.js');

exports.run = function(enableCrypt, port, callback) {

  var server = net.createServer(function(client){
    client.info = {
      ipv4: misc.IPv4toInt32LE(client.remoteAddress),
      logged: false,
      storageId: -1,
      id: -1,
      hasLowId: true,
    };
    log.info('Connect: '+client.info.ipv4);
    client.packet = new Packet(client);

    if (enableCrypt) {
      client.crypt = new TcpCrypt(client.packet);
      client.on('data', function(data){
        data = client.crypt.decrypt(data);
        op.processData(data, client);
      });
    }
    else {
      client.crypt = false;
      client.on('data', function(data){
        op.processData(data, client);
      });
    }

    client.on('end', function(){
      log.alert('Client socket end: '+client.info.storageId);
    });

    client.on('close', function(){
      log.alert('Client socket close: '+client.info.storageId);
      if (client.info.hasLowId) { lowIdClients.remove(client.info.id); }
      db.clients.disconnect(client.info);
    });

    client.on('error', function(err){
      log.error('Client socket error.'+err);
      console.dir(err);
      console.dir(client);
      client.end();
    });

  });

  server.on('error', function(err){
    switch (err.code) {
      case 'EADDRNOTAVAIL':
        log.panic('Address '+conf.address+' not available.');
        process.exit();
        break;
      default: log.error('Server error: '+JSON.stringify(err));
    }
  });

  server.listen(port, conf.address, 511, function(){
    server.maxConnections = conf.tcp.maxConnections;
    log.ok('Listening to TCP: '+port+' (Max connections: '+server.maxConnections+')');
    if (typeof callback == 'function') { callback(); }
  });

};

(function updateConfig() {
  console.log('+-------------+');
  console.log('| '+ENODE_NAME+' '+ENODE_VERSIONSTR+' |');
  console.log('+-------------+');

  conf.hash = crypt.md5(conf.address+conf.tcp.port);
  log.info('Server hash: '+conf.hash.toString('hex'));

  conf.tcp.flags =
    FLAG_ZLIB +
    FLAG_NEWTAGS +
    FLAG_UNICODE +
    FLAG_LARGEFILES +
    (conf.auxiliarPort ? FLAG_AUXPORT : 0) +
    (conf.requireCrypt ? FLAG_REQUIRECRYPT : 0) +
    (conf.requestCrypt ? FLAG_REQUESTCRYPT : 0) +
    (conf.supportCrypt ? FLAG_SUPPORTCRYPT : 0) +
    (conf.IPinLogin ? FLAG_IPINLOGIN : 0);
  log.info('TCP flags: 0x'+conf.tcp.flags.toString(16)+' - '+conf.tcp.flags.toString(2));

})();
