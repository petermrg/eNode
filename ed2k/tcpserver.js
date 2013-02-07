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
        if (id != false) { lowIdClients.clients[id] = client; }
        return id;
    },
    get: function(id) {
        if (lowIdClients._clients.hasOwnProperty(id)) { return lowIdClients.clients[id]; }
        else { return false; }
    },
};
exports.lowIdClients = lowIdClients;

var errTCP = function(err) {
    if (err) {
        log.error(err);
        console.trace();
    }
}

var receive = {

    loginRequest: function(client) {
        log.debug(client.remoteAddress+' > LOGINREQUEST');
        var data = client.packet.data;
        client.info = misc.dec(client.info);
        client.info.hash = data.get(16).toString('hex');
        client.info.id = data.get(4);
        client.info.port = data.getUInt16LE();
        //log.trace('Client Hash: '+client.info.hash.toString('hex'));
        data.getTags(function(tag){
            //log.trace(tag);
            client.info[tag[0]] = tag[1];
        });
        log.info('Checking if '+client.remoteAddress+':'+client.info.port+' is firewalled...');

        var socket = new TCP.Socket();
        var setLowId = function() {
            send.serverMessage(conf.messageLowID, client);
            client.info.id = lowIdClients.add(client);
            if (client.info.id != false) {
                client.info.hasLowId = true;
                log.info('Assign LowId: '+client.remoteAddress+' -> '+client.info.id);
                send.handShake(client);
            }
            else { client.end(); }
            socket.destroy();
        };
        socket.on('error', setLowId);
        socket.setTimeout(conf.tcp.connectionTimeout, setLowId);
        socket.connect({port: client.info.port, host: client.remoteAddress, localAddress: conf.address}, function(){
            client.info.id = misc.IPv4toInt32LE(client.remoteAddress);
            client.info.hasLowId = false;
            log.info('Assign HighID: '+client.remoteAddress+' -> '+client.info.id);
            send.handShake(client);
            socket.destroy();
        })
    },

    offerFiles: function(client) {
        log.debug('OFFERFILES < '+client.remoteAddress);
        var clientInfo = misc.dec(client.info);
        var count = client.packet.data.getFileList(function(file){
            //log.trace(file.name+' '+file.size+' '+file.hash.toString('hex'));
            db.files.add(file, clientInfo);
        });
        log.trace('Got '+count+' files from '+client.remoteAddress+
            ' Total files: '+db.files.count());
    },

    getServerList: function(client) {
        log.debug('GETSERVERLIST < '+client.remoteAddress);
        send.serverList(client);
        send.serverIdent(client);
    },

    getSources: function(client) {
        log.debug('GETSOURCES < '+client.remoteAddress);
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
            receive.foundSources(fileHash, sources, client);
        });
    },

    foundSources: function(fileHash, sources, client) {
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

    searchRequest: function(client) {
        log.info('SEARCHREQUEST < '+client.remoteAddress);
        //log.text(hexDump(client.packet.data));
        db.files.find(client.packet.data, function(files){
            var pack = [
                [TYPE_UINT8, OP_SEARCHRESULT],
                [TYPE_UINT32, files.length]
            ];
            files.forEach(function(f){
                //console.dir(f);
                var tags = [
                    [TYPE_STRING, TAG_NAME, f.name],
                    [TYPE_UINT32, TAG_SIZE, f.size % 0x100000000],
                    [TYPE_STRING, TAG_TYPE, f.type],
                    [TYPE_UINT32, TAG_SOURCES, f.sources],
                    [TYPE_UINT32, TAG_COMPLETE_SOURCES, f.completed],
                ];
                if (f.size >= 0x100000000) tags.push(
                    [TYPE_UINT32, TAG_SIZE_HI, Math.floor(f.size/0x100000000)]);
                if (f.title != '') tags.push([TYPE_STRING, TAG_MEDIA_TITLE, f.title]);
                if (f.artist != '') tags.push([TYPE_STRING, TAG_MEDIA_ARTIST, f.artist]);
                if (f.album != '') tags.push([TYPE_STRING, TAG_MEDIA_ALBUM, f.album]);
                if (f.runtime > 0) tags.push([TYPE_UINT32, TAG_MEDIA_LENGTH, f.runtime]);
                if (f.bitrate > 0) tags.push([TYPE_UINT32, TAG_MEDIA_BITRATE, f.bitrate]);
                if (f.codec != '') tags.push([TYPE_STRING, TAG_MEDIA_CODEC, f.codec]);
                pack.push([TYPE_HASH, f.hash]);
                pack.push([TYPE_UINT32, f.source_id]);
                pack.push([TYPE_UINT16, f.source_port]);
                pack.push([TYPE_TAGS, tags]);
            });
            client.write(Packet.make(PR_ED2K, pack), errTCP);
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
        log.info('CALLBACKREQUEST < '+client.remoteAddress);
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
        //TODO exception handling
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
        try {
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
        } catch(err) {
            log.error('TCP receive.parse: '+err);
            console.trace();
        }
        client.packet.status = PS_NEW;
        return true;
    },

};

var send = {

    serverList: function(client) {
        log.debug('SERVERLIST > '+client.remoteAddress);
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
        log.debug('SERVERSTATUS > '+client.remoteAddress+' clients: '+db.clients.count()+
            ' files: '+db.files.count());
        var pack = Packet.make(PR_ED2K, [
            [TYPE_UINT8, OP_SERVERSTATUS],
            [TYPE_UINT32, db.clients.count()],
            [TYPE_UINT32, db.files.count()]
        ]);
        client.write(pack, errTCP);
    },

    idChange: function(id, client) {
        log.debug('IDCHANGE > '+client.remoteAddress+' id: '+id);
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
        log.debug('CALLBACKFAILED > '+client.remoteAddress+' id: '+id);
        var pack = [[TYPE_UINT8, OP_CALLBACKFAILED]];
        client.write(Packet.make(PR_ED2K, pack), errTCP);
    },

    serverIdent: function(client) {
        log.debug('SERVERIDENT > '+client.remoteAddress);
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

    handShake: function(client) {
        db.clients.connect(client.info, function(clientStorageId){
            if (clientStorageId != false) {
                //log.info('Storage ID: '+clientStorageId);
                client.info.storageId = clientStorageId;
                send.serverMessage(conf.messageLogin, client);
                send.serverMessage('server version '+ENODE_VERSIONSTR+' ('+ENODE_NAME+')', client);
                send.serverStatus(client);
                send.idChange(client.info.id, client);
                client.info.logged = true;
                if (!client.info.hasLowId) {
                    client.info = misc.enc(client.info); // store client.info outside the V8 heap
                }
                else {
                    var hexId = client.info.id.toString(16);
                    client.info = misc.enc(client.info);
                    lowIdClients[hexId] = client;
                }
            }
            else {
                send.serverMessage(err, client);
                log.todo('handShake: send reject command');
                client.end();
            }
        });
    },

    serverMessage: function(message, client) {
        log.debug('SERVERMESSAGE > '+client.remoteAddress+' '+message.split('\n')[0]);
        var pack = Packet.make(PR_ED2K, [
            [TYPE_UINT8, OP_SERVERMESSAGE],
            [TYPE_STRING, message]
        ]);
        client.write(pack, errTCP);
    },

    callbackRequested: function(clientWithLowId, client) {
        log.info('CALLBACKREQUESTED > '+clientWithLowId.remoteAddress);
        var clientInfo = misc.dec(client.info);
        var pack = [
            [TYPE_UINT8, OP_CALLBACKREQUESTED],
            [TYPE_UINT32, misc.IPv4toInt32LE(clientInfo.remoteAddress)],
            [TYPE_UINT16, clientInfo.port],
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
};

exports.run = function(callback) {
    var server = TCP.createServer(function(client){
        log.info('Connect: '+client.remoteAddress+':'+client.remotePort);
        client.packet = new Packet();
        client.info = misc.enc({
            remoteAddress: client.remoteAddress,
            remotePort: client.remotePort,
            logged: false,
        });

        client.on('data', function(buffer){
            processPacket(buffer, client);
        });

        client.on('end', function(){
            log.info('TCP connection end');
            var clientInfo = (client.info instanceof Buffer) ? misc.dec(client.info) : client.info;
            log.info('Disconnect: '+clientInfo.remoteAddress+':'+clientInfo.remotePort);
            db.clients.disconnect(clientInfo);
            if (client.info.hasLowId) { delete clientWithLowId[client.info.id]; }
            delete client;
            log.todo('TCP>client.end: Update client\'s files values for sources and completed ??');
        });

    })
    server.on('error', function(err){
        switch (err.code) {
            case 'EADDRNOTAVAIL': log.panic('Address '+conf.address+' not available.'); break;
            default: log.panic(err);
        }
        process.exit();
    });
    server.listen(conf.tcp.port, conf.address, 511, function(){
        server.maxConnections = conf.tcp.maxConnections;
        log.ok('Listening to TCP: '+conf.tcp.port+' (Max connections: '+server.maxConnections+')');
        if (typeof callback == 'function') { callback(); }
    });
}
