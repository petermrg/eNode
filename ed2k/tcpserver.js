var net = require('net');
var log = require('tinylogger');
var db = require('../storage/storage.js');
var misc = require('./misc.js');
var Packet = require('./packet.js').Packet;
var TcpCrypt = require('./tcpcrypt.js').TcpCrypt;
var conf = require('../enode.config.js').config;
var lowIdClients = require('./lowidclients.js').lowIdClients;
var op = require('./tcpoperations.js');


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
        client.crypt = enableCrypt ? (new TcpCrypt(client.packet)) : false;

        if (enableCrypt) {
            client.on('data', function(data){
                data = client.crypt.decrypt(data);
                op.processData(data, client);
            });
        }
        else {
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
