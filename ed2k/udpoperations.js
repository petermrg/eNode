var db = require('../storage/storage.js');
var hexDump = require('hexy').hexy;
var misc = require('./misc.js');
var Packet = require('./packet.js').Packet;
var log = require('tinylogger');
var lowIdClients = require('./lowidclients.js').lowIdClients;
var conf = require('../enode.config.js').config;
require('./buffer.js');

var sendError = function(err) {
    if (err) { log.error(err); }
}
/*
-Keycreation Client <-> Server:
    - Client A (Outgoing connection client -> server):
        Sendkey:    Md5(<BaseKey 4><MagicValueClientServer 1><RandomKeyPartClientA 2>)  7
    - Client B (Incomming connection):
        Receivekey: Md5(<BaseKey 4><MagicValueServerClient 1><RandomKeyPartClientA 2>)  7
    - Note: The first 1024 Bytes will be _NOT_ discarded for UDP keys to safe CPU time

- Handshake
    - The handshake is encrypted - except otherwise noted - by the Keys created above
    - Padding is cucrently not used for UDP meaning that PaddingLen will be 0, using PaddingLens up
      to 16 Bytes is acceptable however

    Client A: <SemiRandomNotProtocolMarker 1[Unencrypted]><RandomKeyPart 2[Unencrypted]>
        <MagicValue 4><PaddingLen 1><RandomBytes PaddingLen%16>

- Overhead: 8 Bytes per UDP Packet

- Security for Basic Obfuscation:
- Random looking packets, very limited protection against passive eavesdropping single packets

- Additional Comments:
- For obvious reasons the UDP handshake is actually no handshake. If a different Encryption method
  (or better a different Key) is to be used this has to be negotiated in a TCP connection
- SemiRandomNotProtocolMarker is a Byte which has a value unequal any Protocol header byte. This is
  a compromiss, turning in complete randomness (and nice design) but gaining a lower CPU usage.

#define MAGICVALUE_UDP                      91
#define MAGICVALUE_UDP_SYNC_CLIENT          0x395F2EC1
#define MAGICVALUE_UDP_SYNC_SERVER          0x13EF24D5
#define MAGICVALUE_UDP_SERVERCLIENT         0xA5
#define MAGICVALUE_UDP_CLIENTSERVER         0x6B
*/
var processData = function(buffer, info, udpServer) {
    var protocol = buffer.getUInt8();
    var code = buffer.getUInt8();
    switch (protocol) {
        case PR_ED2K:
            switch (code) {
                case OP_GLOBGETSOURCES: receive.globGetSources(buffer, info, udpServer); break;
                case OP_GLOBGETSOURCES2: receive.globGetSources2(buffer, info, udpServer); break;
                case OP_GLOBSERVSTATREQ: receive.globServStatReq(buffer, info, udpServer); break;
                case OP_SERVERDESCREQ: receive.servDescReq(buffer, info, udpServer); break;
                case OP_GLOBSEARCHREQ: receive.globSearchReq(buffer, info, udpServer); break;
                case OP_GLOBSEARCHREQ3: receive.globSearchReq3(buffer, info, udpServer); break;
                default: log.warn('UDP processData: unknown operation code: 0x'+code.toString(16));
            }
            break;
        default:
            log.warn('UDP: Unsupported protocol 0x'+protocol.toString(16))
            log.text(hexDump(buffer));
    }
}
exports.processData = processData;

var receive = {

    globGetSources: function(buffer, info, udpServer) {
        log.info('GLOBGETSOURCES < '+info.address+':'+info.port);
        if (!conf.udp.getSources) { return; }
        buffer = buffer.get();
        var count = Math.floor(buffer.length/16);
        while (count--) {
            var hash = buffer.get(16);
            db.files.getSourcesByHash(hash, function(fileHash, sources){
                log.trace('Got '+sources.length+' sources for file: '+fileHash.toString('hex'));
                if (sources.length > 0) {
                    send.globFoundSources(fileHash, sources, info, udpServer);
                }
            });
        }
        if (buffer.pos() < buffer.length) {
            log.warn('globGetSources: Excess data: 0x'.buffer.get().toString('hex'));
        }
    },

    globGetSources2: function(buffer, info, udpServer) {
        log.info('GLOBGETSOURCES2 < '+info.address+':'+info.port);
        while (buffer.pos()+16+4 <= buffer.length) {
            var hash = buffer.get(16);
            var size = buffer.getUInt32LE();
            if (size == 0) { size = buffer.getUInt64LE(); }
            db.files.getSources(hash, size, function(fileHash, sources){
                log.trace('Got '+sources.length+' sources for file: '+fileHash.toString('hex'));
                if (sources.length > 0) {
                    send.globFoundSources(fileHash, sources, info, udpServer);
                }
            });
        }
        if (buffer.pos() < buffer.length) {
            log.warn('globGetSources2: Excess data: 0x'.buffer.get().toString('hex'));
        }
    },

    globServStatReq: function(buffer, info, udpServer) {
        log.info('GLOBSERVSTATREQ < '+info.address+':'+info.port);
        var challenge = buffer.getUInt32LE();
        send.globServStatRes(challenge, info, udpServer);
    },

    servDescReq: function(buffer, info, udpServer) {
        log.info('SERVERDESCREQ < '+info.address+':'+info.port);
        if (info.size < 6) {
            send.servDescResOld(info, udpServer);
        }
        else {
            var challenge = buffer.getUInt32LE();
            send.servDescRes(challenge, info, udpServer);
        }
    },

    globSearchReq: function(buffer, info, udpServer) {
        log.info('GLOBSEARCHREQ < '+info.address+':'+info.port);
        db.files.find(buffer, function(files) {
            if (files.length > 0) {
                send.globSearchRes(files, info, udpServer);
            }
        });
    },

    globSearchReq3: function(buffer, info, udpServer) {
        log.info('GLOBSEARCHREQ3 < '+info.address+':'+info.port);
        //console.log(hexDump(buffer));
        buffer.getTags(function(tag){
            if (tag[0] == 'searchtree') {
                log.todo('globSearchReq3: not sure about what to do here');
                log.trace('Got a search tree: 0x'+tag[1].toString(16));
            }
        });
        db.files.find(buffer, function(files) {
            if (files.length > 0) {
                send.globSearchRes(files, info, udpServer);
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
    globSearchRes: function(files, info, udpServer){
        log.info('GLOBSEARCHRES > '+info.address+' ('+files.length+' files)');
        files.forEach(function(file){
            var pack = [[TYPE_UINT8, OP_GLOBSEARCHRES]];
            Packet.addFile(pack, file);
            var buffer = Packet.makeUDP(PR_ED2K, pack);
            udpServer.send(buffer, 0, buffer.length, info.port, info.address, sendError);
        });
    },

    globFoundSources: function(fileHash, sources, info, udpServer) {
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
        var buffer = Packet.makeUDP(PR_ED2K, pack);
        udpServer.send(buffer, 0, buffer.length, info.port, info.address, sendError);
    },

    globServStatRes: function(challenge, info, udpServer) {
        log.info('GLOBSERVSTATRES > '+info.address+':'+info.port);
        var pack = [
            [TYPE_UINT8, OP_GLOBSERVSTATRES],
            [TYPE_UINT32, challenge],
            [TYPE_UINT32, db.clients.count()+2000], // fake value, for testing
            [TYPE_UINT32, db.files.count()],
            [TYPE_UINT32, conf.tcp.maxConnections],
            [TYPE_UINT32, 10000], // server soft file limit ???
            [TYPE_UINT32, 20000], // server hard file limit ???
            [TYPE_UINT32, conf.udp.flags],
            [TYPE_UINT32, lowIdClients.count()+1000], // fake value, for testing
            [TYPE_UINT16, conf.udp.portObfuscated],
            [TYPE_UINT16, conf.tcp.portObfuscated],
            [TYPE_UINT32, 0x12345678], // udp server key ???
        ];
        var buffer = Packet.makeUDP(PR_ED2K, pack);
        udpServer.send(buffer, 0, buffer.length, info.port, info.address, sendError);
    },

    servDescResOld: function(info, udpServer) {
        log.info('SERVERDESCRES (OLD) > '+info.address+':'+info.port);
        var pack = [
            [TYPE_UINT8, OP_SERVERDESCRES],
            [TYPE_STRING, conf.name],
            [TYPE_STRING, conf.description],
        ];
        var buffer = Packet.makeUDP(PR_ED2K, pack);
        udpServer.send(buffer, 0, buffer.length, info.port, info.address, sendError);
    },

    servDescRes: function(challenge, info, udpServer) {
        log.info('SERVERDESCRES > '+info.address+':'+info.port);
        var pack = [
            [TYPE_UINT8, OP_SERVERDESCRES],
            [TYPE_UINT32, challenge],
            [TYPE_TAGS, [
                [TYPE_STRING, TAG_NAME, conf.name],
                [TYPE_STRING, TAG_DESCRIPTION, conf.description],
                [TYPE_STRING, TAG_DYNIP, conf.dynIp],
                //[TYPE_STRING, TAG_VERSION2, ENODE_VERSIONSTR],
                [TYPE_UINT32, TAG_VERSION2, ENODE_VERSIONINT],
                [TYPE_STRING, TAG_AUXPORTSLIST, ''],
            ]],
        ];
        var buffer = Packet.makeUDP(PR_ED2K, pack);
        udpServer.send(buffer, 0, buffer.length, info.port, info.address, sendError);
    },

}

