//https://github.com/bluesmoon/node-geoip

var TCP = require('net');
var zlib = require('zlib');

var log = require('tinylogger');
var db = require('./storage.js');
var hexDump = require('hexy').hexy;
var misc = require('./misc.js');
var Packet = require('./packet.js').Packet;
var conf = require('../enode.config.js').config;

var lowIdClients = {
    _min: 1,
    _max: 0xffffff,
    _count: 0,
    _next: 1,
    _clients: {},
    _nextId: function() {
        if (!conf.tcp.allowLowIDs) return false;
        if (lowIdClients._count >= lowIdClients._max - lowIdClients._min + 1) return false;
        var r = lowIdClients._next;
        lowIdClients._next++;
        while (lowIdClients._clients.hasOwnProperty[lowIdClients._next]) {
            lowIdClients._next++;
            if (lowIdClients._next > lowIdClients._max) { lowIdClients._next = lowIdClients._min; };
        }
        return r;
    },
    count: function() { return lowIdClients._count; },
    add: function(client) {
        var id = lowIdClients._nextId();
        if (id != false) { lowIdClients._clients[id] = client; }
        return id;
    },
    get: function(id) {
        if (lowIdClients._clients.hasOwnProperty(id)) { return lowIdClients.clients[id]; }
        else { return false; }
    },
    remove: function(id) {
        lowIdClients._count--;
        delete lowIdClients._clients[id];

    }
};
exports.lowIdClients = lowIdClients;

var errTCP = function() {
    log.error('TCP error');
}

/**
 * @description Checks if a client is firewalled
 * @param {net.Socket} client
 * @param {net.Socket.remoteAddress} remoteAddress
 * @param {net.Socket.info} client info
 * @param {net.Socket.info.port} client port to check
 * @param {Function(firewalled)}
 * @requires {Object} conf global configuration
 */
var isFirewalled = function(client, callback) {
    log.info('Checking if '+client.remoteAddress+':'+client.info.port+' is firewalled...');
    var socket = new TCP.Socket();
    socket.on('error', function(){callback(true)});
    socket.setTimeout(conf.tcp.connectionTimeout, function(){callback(true)});
    socket.connect({port: client.info.port, host: client.remoteAddress, localAddress: conf.address}, function(){
        callback(false);
        socket.end();
    });
}

var receive = {

    handShake: function(client) {
        db.clients.connect(client.info, function(err, storageId){
            if (err == false) {
                client.info.logged = true;
                log.info('Storage ID: '+storageId);
                client.info.storageId = storageId;
                send.serverMessage(conf.messageLogin, client);
                send.serverMessage('server version '+ENODE_VERSIONSTR+' ('+ENODE_NAME+')', client);
                send.serverStatus(client);
                send.idChange(client.info.id, client);
            }
            else {
                log.error(err);
                //send.serverMessage(clientStorage.message, client);
                log.todo('handShake: send reject command');
                //client.end();
            }
        });
    },

    /**
     * @param {net.Socket} client
     */
    loginRequest: function(client) {
        log.debug(client.info.ipv4+' > LOGINREQUEST');
        var data = client.packet.data;
        client.info.hash = data.get(16);
        client.info.id = data.getUInt32LE();
        client.info.port = data.getUInt16LE();
        data.getTags(function(tag){
            log.trace('+ '+tag);
            client.info[tag[0]] = tag[1];
        });
        db.clients.isConnected(client.info, function(err, connected){
            if (err) { log.error('loginRequiest: '+err); client.end(); return; }
            if (connected) { log.error('loginRequiest: already connected'); client.end(); return; }
            isFirewalled(client, function(firewalled){
                if (firewalled) {
                    client.info.hasLowId = true;
                    send.serverMessage(conf.messageLowID, client);
                    client.info.id = lowIdClients.add(client);
                    if (client.info.id != false) {
                        receive.handShake(client);
                        log.info('Assign LowId: '+client.info.id);
                    }
                    else { client.end(); }
                }
                else {
                    client.info.hasLowId = false;
                    client.info.id = client.info.ipv4;
                    client.info.hasLowId = false;
                    receive.handShake(client);
                    log.info('Assign HighID: '+client.info.id);
                }
            });
        });
    },

    offerFiles: function(client) {
        log.debug('OFFERFILES < '+client.info.id);
        var count = client.packet.data.getFileList(function(file){
            //log.trace(file.name+' '+file.size+' '+file.hash.toString('hex'));
            db.files.add(file, client.info);
        });
        log.trace('Got '+count+' files from '+client.remoteAddress+
            ' Total files: '+db.files.count());
    },

    getServerList: function(client) {
        log.debug('GETSERVERLIST < '+client.info.id);
        send.serverList(client);
        send.serverIdent(client);
    },

    getSources: function(client) {
        log.debug('GETSOURCES < '+client.info.id);
        var file = {
            hash: client.packet.data.get(16),
            size: client.packet.data.getUInt32LE(),
            sizehi: 0,
        };
        if (file.size == 0) { // large file, read 64bits
            file.size = client.packet.data.getUInt32LE();
            file.size+= client.packet.data.getUInt32LE() * 0x100000000;
        }
        db.files.getSources(file.hash, file.size, function(fileHash, sources){
            log.trace('Got '+sources.length+' sources for file: '+fileHash.toString('hex'));
            send.foundSources(fileHash, sources, client);
        });
    },

    searchRequest: function(client) {
        log.info('SEARCHREQUEST < '+client.info.id);
        //log.text(hexDump(client.packet.data));
        db.files.find(client.packet.data, function(files){
            send.searchResult(files, client);
        });
    },

//
// Client A (High ID)        Server                    Client B (Low ID)
//    |>---CallbackRequest---->|                          |
//    |                        |>---CallbackRequested---->|
//    |<----------------------------------Connect--------<|
//    :                        :                          :
//    |<----CallbackFailed----<|                          |

    callbackRequest: function(client) {
        log.info('CALLBACKREQUEST < '+client.info.id);
        var lowId = client.packet.data.getUInt32LE(); // properties are hex strings
        clientWithLowId = lowIdClients.get(lowId);
        if (clientWithLowId != false) {
            send.callbackRequested(clientWithLowId, client);
        }
        else {
            log.debug('CallbackRequest failed: LowId client is not connected');
            send.callbackFailed(client);
        }
    },

    ed2k: function(client) {
        client.packet.data.pos(0);
        switch (client.packet.code) {
            case OP_LOGINREQUEST: receive.loginRequest(client); break;
            case OP_OFFERFILES: receive.offerFiles(client); break;
            case OP_GETSERVERLIST: receive.getServerList(client); break;
            case OP_GETSOURCES: receive.getSources(client); break;
            case OP_SEARCHREQUEST: receive.searchRequest(client); break;
            case OP_CALLBACKREQUEST: receive.callbackRequest(client); break;
            default:
                log.warn('receive.ed2k: Unhandled receive: 0x'+client.packet.code.toString(16));
        }
    },

    parse: function(client) {
        //log.trace('TCP receive.parse');
        //log.trace(client.info);
        switch (client.packet.protocol) {
            case PR_ED2K:
                receive.ed2k(client);
                break;
            case PR_ZLIB:
                zlib.unzip(client.packet.data, function(err, buffer) {
                    if (!err) {
                        //log.ok('unzip'); // unzip ok
                        client.packet.data = buffer;
                        receive.ed2k(client);
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
    },

};

var send = {

    foundSources: function(fileHash, sources, client) {
        log.debug('FOUNDSOURCES > '+client.info.id);
        var pack = [
            [TYPE_UINT8, OP_FOUNDSOURCES],
            [TYPE_HASH, fileHash],
            [TYPE_UINT8, sources.length]
        ];
        sources.forEach(function(src){
            pack.push([TYPE_UINT32, src.id]);
            pack.push([TYPE_UINT16, src.port]);
        });
        //log.debug(pack);
        client.write(Packet.make(PR_ED2K, pack), errTCP);
    },

    searchResult: function(files, client) {
        log.debug('SEARCHRESULT > '+client.info.id);
        var pack = [
            [TYPE_UINT8, OP_SEARCHRESULT],
            [TYPE_UINT32, files.length]
        ];
        files.forEach(function(file){
            //console.dir(f);
            Packet.addFile(pack, file)
        });
        client.write(Packet.make(PR_ED2K, pack), errTCP);
    },

    serverList: function(client) {
        log.debug('SERVERLIST > '+client.info.id);
        var pack = [
            [TYPE_UINT8, OP_SERVERLIST],
            [TYPE_UINT8, db.servers.count()],
        ];
        db.servers.all().forEach(function(v){
            log.trace(v.ip+':'+v.port);
            pack.push([TYPE_UINT32, misc.IPv4toInt32LE(v.ip)]);
            pack.push([TYPE_UINT16, v.port]);
        });
        //console.dir(pack);
        client.write(Packet.make(PR_ED2K, pack), errTCP);
    },

    serverStatus: function(client) {
        log.debug('SERVERSTATUS > '+client.info.id+' clients: '+db.clients.count()+
            ' files: '+db.files.count());
        var pack = Packet.make(PR_ED2K, [
            [TYPE_UINT8, OP_SERVERSTATUS],
            [TYPE_UINT32, db.clients.count()],
            [TYPE_UINT32, db.files.count()]
        ]);
        client.write(pack, errTCP);
    },

    idChange: function(id, client) {
        log.debug('IDCHANGE > '+client.info.id+' id: '+id);
        var flags = FLAG_ZLIB + FLAG_NEWTAGS + FLAG_UNICODE + FLAG_LARGEFILES +
            (conf.auxiliarPort ? FLAG_AUXPORT : 0) +
            (conf.requireCrypt ? FLAG_REQUIRECRYPT : 0) +
            (conf.requestCrypt ? FLAG_REQUESTCRYPT : 0) +
            (conf.supportCrypt ? FLAG_SUPPORTCRYPT : 0) +
            (conf.IPinLogin ? FLAG_IPINLOGIN : 0);
        var pack = Packet.make(PR_ED2K, [
            [TYPE_UINT8, OP_IDCHANGE],
            [TYPE_UINT32, id],
            [TYPE_UINT32, flags]
        ]);
        client.write(pack, errTCP);
    },

    callbackFailed: function(client) {
        log.debug('CALLBACKFAILED > '+client.info.id+' id: '+id);
        var pack = [[TYPE_UINT8, OP_CALLBACKFAILED]];
        client.write(Packet.make(PR_ED2K, pack), errTCP);
    },

    serverIdent: function(client) {
        log.debug('SERVERIDENT > '+client.info.id);
        if (Packet.cache.serverIdent == undefined) {
            var hash = new Buffer(16);
            hash.write(misc.md5(conf.name+conf.tcp.port+conf.version), 'hex');
            var pack = [
                [TYPE_UINT8, OP_SERVERIDENT],
                [TYPE_HASH, hash],
                [TYPE_UINT32, misc.IPv4toInt32LE(conf.address)],
                [TYPE_UINT16, conf.tcp.port],
                [TYPE_TAGS, [
                    [TYPE_STRING, TAG_SERVER_NAME, conf.name],
                    [TYPE_STRING, TAG_SERVER_DESC, conf.description]
                ]],
            ];
            Packet.cache.serverIdent = Packet.make(PR_ED2K, pack);
        }
        client.write(Packet.cache.serverIdent, errTCP);
    },

    serverMessage: function(message, client) {
        log.debug('SERVERMESSAGE > '+client.info.id+' '+message);
        var pack = Packet.make(PR_ED2K, [
            [TYPE_UINT8, OP_SERVERMESSAGE],
            [TYPE_STRING, message.toString()],
        ]);
        client.write(pack, errTCP);
    },

    callbackRequested: function(clientWithLowId, client) {
        log.info('CALLBACKREQUESTED > '+clientWithLowId.info.id);
        var pack = [
            [TYPE_UINT8, OP_CALLBACKREQUESTED],
            [TYPE_UINT32, client.info.ipv4],
            [TYPE_UINT16, client.info.port],
        ];
        clientWithLowId.write(Packet.make(PR_ED2K, pack), function(err){
            if (err) {
                errTCP(err);
                send.callbackFailed(client);
            }
        });
    },

};

var processPacket = function(buffer, client) {
    //log.trace('processPacket. packet.status: '+client.packet.status);
    //try {
        switch (client.packet.status) {
            case PS_NEW: client.packet.init(buffer); break;
            case PS_WAITING_DATA: client.packet.append(buffer); break;
            default: log.error('processPacket: Bad packet status: 0x'+client.packet.status);
        }
        if (client.packet.status == PS_READY) {
            receive.parse(client);
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
    var server = TCP.createServer(function(client){
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
            default: log.panic(err);
        }
    });
    server.listen(conf.tcp.port, conf.address, 511, function(){
        server.maxConnections = conf.tcp.maxConnections;
        log.ok('Listening to TCP: '+conf.tcp.port+' (Max connections: '+server.maxConnections+')');
        if (typeof callback == 'function') { callback(); }
    });
}
