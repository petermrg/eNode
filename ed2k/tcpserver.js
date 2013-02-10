var net = require('net');
var zlib = require('zlib');
var log = require('tinylogger');
var db = require('./storage.js');
var hexDump = require('hexy').hexy;
var misc = require('./misc.js');
var Packet = require('./packet.js').Packet;
var conf = require('../enode.config.js').config;
var op = require('./tcpoperations.js');

//TODO this should be moved into Packet
var parse = function(client) {
    //log.trace('TCP op.receive.parse');
    //log.trace(client.info);
    switch (client.packet.protocol) {
        case PR_ED2K:
            op.ed2k(client);
            break;
        case PR_ZLIB:
            zlib.unzip(client.packet.data, function(err, buffer) {
                if (!err) {
                    //log.ok('unzip'); // unzip ok
                    client.packet.data = buffer;
                    op.ed2k(client);
                }
                else {
                    log.error('Cannot unzip: operation 0x'+client.packet.code.tostring(16));
                }
            });
            break;
        case PR_EMULE:
            log.warn('TCP: Unsupported protocol: PR_EMULE (0x'+
                client.packet.protocol.toString(16)+')');
            break;
        default:
            log.warn('TCP: Unknown protocol: 0x'+client.packet.protocol.toString(16));
            log.text(hexDump(client.packet.data));
    }
    client.packet.status = PS_NEW;
    return true;
};

//TODO this should be moved into Packet
var processPacket = function(buffer, client) {
    //log.trace('processPacket. packet.status: '+client.packet.status);
    //try {
        switch (client.packet.status) {
            case PS_NEW: client.packet.init(buffer); break;
            case PS_WAITING_DATA: client.packet.append(buffer); break;
            default: log.error('processPacket: Bad packet status: 0x'+client.packet.status);
        }
        if (client.packet.status == PS_READY) {
            parse(client);
            if (client.packet.hasExcess) {
                processPacket(client.packet.excess, client);
            }
        }
    // } catch(err) {
    //     log.error(JSON.stringify(err));
    //     console.trace();
    // }
};

exports.run = function(callback) {

    var server = net.createServer(function(client){
        client.info = {
            ipv4: misc.IPv4toInt32LE(client.remoteAddress),
            logged: false,
            storageId: -1,
            id: -1,
            hasLowId: true,
        };
        log.info('Connect: '+client.ipv4);
        client.packet = new Packet();

        client.on('data', function(buffer){
            processPacket(buffer, client);
        });

        client.on('end', function(){
            log.alert('Client socket end: '+client.info.ipv4);
        });

        client.on('close', function(){
            log.alert('Client socket close: '+client.info.ipv4);
            if (client.info.hasLowId) { lowIdClients.remove(client.info.id); }
            db.clients.disconnect(client.info);
        });

        client.on('error', function(err){
            log.error('Client socket error.'+err);
            console.dir(err);
            console.dir(client);
            client.end();
        });

    })

    server.on('error', function(err){
        switch (err.code) {
            case 'EADDRNOTAVAIL':
                log.panic('Address '+conf.address+' not available.');
                process.exit();
                break;
            default: log.panic(JSON.stringify(err));
        }
    });

    server.listen(conf.tcp.port, conf.address, 511, function(){
        server.maxConnections = conf.tcp.maxConnections;
        log.ok('Listening to TCP: '+conf.tcp.port+' (Max connections: '+server.maxConnections+')');
        if (typeof callback == 'function') { callback(); }
    });

}
