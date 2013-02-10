var dgram = require('dgram');
var db  = require('./storage.js');
var hexDump = require('hexy').hexy;
var misc = require('./misc.js');
var Packet = require('./packet.js').Packet;
var log = require('tinylogger');
var lowIdClients = require('./tcpserver.js').lowIdClients;
var conf = require('../enode.config.js').config;
require('./buffer.js');

var udpServer = dgram.createSocket('udp4');

var receive = {

    globGetSources: function(buffer, info) {
        log.info('GLOBGETSOURCES < '+info.address+':'+info.port);
        if (!conf.udp.getSources) { return; }
        buffer = buffer.get();
        var count = Math.floor(buffer.length/16);
        while (count--) {
            var hash = buffer.get(16);
            db.files.getSourcesByHash(hash, function(fileHash, sources){
                log.trace('Got '+sources.length+' sources for file: '+fileHash.toString('hex'));
                if (sources.length > 0) { send.globFoundSources(fileHash, sources, info); }
            });
        }
        if (buffer.pos() < buffer.length) {
            log.warn('globGetSources: Excess data: 0x'.buffer.get().toString('hex'));
        }
    },

    globGetSources2: function(buffer, info) {
        log.info('GLOBGETSOURCES2 < '+info.address+':'+info.port);
        while (buffer.pos()+16+4 <= buffer.length) {
            var hash = buffer.get(16);
            var size = buffer.getUInt32LE();
            if (size == 0) { size = buffer.getUInt64LE(); }
            db.files.getSources(hash, size, function(fileHash, sources){
                log.trace('Got '+sources.length+' sources for file: '+fileHash.toString('hex'));
                if (sources.length > 0) { send.globFoundSources(fileHash, sources, info); }
            });
        }
        if (buffer.pos() < buffer.length) {
            log.warn('globGetSources2: Excess data: 0x'.buffer.get().toString('hex'));
        }
    },

    globServStatReq: function(buffer, info) {
        log.info('GLOBSERVSTATREQ < '+info.address+':'+info.port);
        var challenge = buffer.getUInt32LE();
        send.globServStatRes(challenge, info);
    },

    servDescReq: function(buffer, info) {
        log.info('SERVERDESCREQ < '+info.address+':'+info.port);
        //console.log(info);
        if (info.size < 6) {
            send.servDescResOld(info);
        }
        else {
            var challenge = buffer.getUInt32LE();
            send.servDescRes(challenge, info);
        }
    },

    globSearchReq3: function(buffer, info) {
        log.info('GLOBSEARCHREQ3 < '+info.address+':'+info.port);
        //console.log(hexDump(buffer));
        buffer.getTags(function(tag){
            if (tag[0] == 'searchtree') {
                //not sure about what to do here
                //console.log('got a search tree: 0x'+tag[1].toString(16));
            }
        });
        db.files.find(buffer, function(files) {
            if (files.length > 0) {
                send.globSearchRes(files, info);
            }
        });
    },


}

var send = {
/*
[13:45:10] David Xanatos: look at case OP_GLOBSEARCHRES:{ in udpsockets.cpp
[13:46:09] David Xanatos: it seams you can concatinate multiple udp packets in one frame
[13:47:47] David Xanatos: it must look like:
OP_EDONKEYPROT
OP_GLOBSEARCHRES
<file>
OP_EDONKEYPROT
OP_GLOBSEARCHRES
<netxt file>
...
*/
    globSearchRes: function(files, info){
        log.info('GLOBSEARCHRES > '+info.address+' ('+files.length+' files)');
        files.forEach(function(file){
            var pack = [[TYPE_UINT8, OP_GLOBSEARCHRES]];
            Packet.addFile(pack, file);
            var buffer = Packet.makeUDP(PR_ED2K, pack);
            udpServer.send(buffer, 0, buffer.length, info.port, info.address, udpErr);
        });
    },

    globFoundSources: function(fileHash, sources, info) {
        log.info('GLOBFOUNDSOURCES < '+info.address+':'+info.port);
        var pack = [
            [TYPE_UINT8, OP_GLOBFOUNDSOURCES],
            [TYPE_HASH, fileHash],
            [TYPE_UINT8, sources.length]
        ];
        sources.forEach(function(src){
            pack.push([TYPE_UINT32, src.id]);
            pack.push([TYPE_UINT16, src.port]);
        });
        //console.dir(pack);
        var buffer = Packet.makeUDP(PR_ED2K, pack);
        udpServer.send(buffer, 0, buffer.length, info.port, info.address, udpErr);
    },

    globServStatRes: function(challenge, info) {
        log.info('GLOBSERVSTATRES > '+info.address+':'+info.port);
        var flags =
            (conf.udp.getSources ? FLAG_UDP_EXTGETSOURCES : 0) +
            (conf.udp.getFiles ? FLAG_UDP_EXTGETFILES : 0) +
            FLAG_NEWTAGS +
            FLAG_UNICODE +
            FLAG_UDP_EXTGETSOURCES2 +
            FLAG_LARGEFILES;
            //FLAG_UDP_UDPOBFUSCATION +
            //FLAG_UDP_TCPOBFUSCATION;
        log.trace('UDP flags: 0x'+flags.toString(16)+' - '+flags.toString(2));
        var pack = [
            [TYPE_UINT8, OP_GLOBSERVSTATRES],
            [TYPE_UINT32, challenge],
            [TYPE_UINT32, db.clients.count()+2000], // fake value, for testing
            [TYPE_UINT32, db.files.count()],
            [TYPE_UINT32, conf.tcp.maxConnections],
            [TYPE_UINT32, 10000], // server soft file limit ??
            [TYPE_UINT32, 20000], // server hard file limit ??
            [TYPE_UINT32, flags],
            [TYPE_UINT32, lowIdClients.count()+1000], // fake value, for testing
            //udpserverkey
            //obfuscation tcp port
            //obfuscation udp port
        ];
        var buffer = Packet.makeUDP(PR_ED2K, pack);
        udpServer.send(buffer, 0, buffer.length, info.port, info.address, udpErr);
    },

    servDescResOld: function(info) {
        log.info('SERVERDESCRES (OLD) > '+info.address+':'+info.port);
        var pack = [
            [TYPE_UINT8, OP_SERVERDESCRES],
            [TYPE_STRING, conf.name],
            [TYPE_STRING, conf.description],
        ];
        //console.log(pack);
        //console.dir(info);
        var buffer = Packet.makeUDP(PR_ED2K, pack);
        udpServer.send(buffer, 0, buffer.length, info.port, info.address, udpErr);
    },

    servDescRes: function(challenge, info) {
        log.info('SERVERDESCRES > '+info.address+':'+info.port);
        var pack = [
            [TYPE_UINT8, OP_SERVERDESCRES],
            [TYPE_UINT32, challenge],
            [TYPE_TAGS, [
                [TYPE_STRING, TAG_NAME, conf.name],
                [TYPE_STRING, TAG_DESCRIPTION, conf.description],
                [TYPE_STRING, TAG_DYNIP, conf.dynIp],
                [TYPE_STRING, TAG_VERSION2, ENODE_VERSIONSTR],
                [TYPE_UINT32, TAG_VERSION2, ENODE_VERSIONINT],
            ]],
        ];
        //console.dir(JSON.stringify(pack));
        //console.dir(info);
        var buffer = Packet.makeUDP(PR_ED2K, pack);
        udpServer.send(buffer, 0, buffer.length, info.port, info.address, udpErr);
    },

}

var udpErr = function(err) {
    if (err) { log.error(err); }
}

var processData = function(buffer, info) {
    //try {
        var protocol = buffer.getUInt8();
        var code = buffer.getUInt8();
        switch (protocol) {
            case PR_ED2K:
                switch (code) {
                    case OP_GLOBGETSOURCES: receive.globGetSources(buffer, info); break;
                    case OP_GLOBGETSOURCES2: receive.globGetSources2(buffer, info); break;
                    case OP_GLOBSERVSTATREQ: receive.globServStatReq(buffer, info); break;
                    case OP_SERVERDESCREQ: receive.servDescReq(buffer, info); break;
                    case OP_GLOBSEARCHREQ3: receive.globSearchReq3(buffer, info); break;
                    default: log.warn('UDP processData: unknown operation code: 0x'+code.toString(16));
                }
                break;
            default:
                log.warn('UDP: Unsupported protocol 0x'+protocol.toString(16))
                log.text(hexDump(msg));
        }
    // } catch(err) {
    //     log.error(JSON.stringify(err));
    //     console.trace();
    // }
}

exports.run = function() {

    udpServer.on('message', function(data, info){
        var buffer = new Buffer(data);
        processData(buffer, info);
    });

    udpServer.on('listening', function(){
      var address = udpServer.address();
      log.ok('Listening to UDP: '+conf.udp.port);
    });

    udpServer.on('error', function(err){
        log.error('UDP error: '+err);
    });

    udpServer.bind(conf.udp.port);

};
