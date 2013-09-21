var net = require('net');
var log = require('tinylogger');
var misc = require('../ed2k/misc.js');
var Packet = require('../ed2k/packet.js').Packet;
var conf = require('../enode.config.js').config;
var lowIdClients = require('../ed2k/lowidclients.js').lowIdClients;
var hexDump = require('hexy').hexy;
require('../ed2k/globals.js');
var zlib = require('zlib');

var connection = {
    host: '91.225.136.126',
    port: '1887',
    //localAddress: '192.168.1.2',
    localAddress: '192.168.43.61',
};

var clientInfo = {
    hash: misc.randBuf(16),
    id: 0x12345678,
    port: 16666,
}

var client;
var server = net.createServer(function(c){

    c.on('data', function(data){
        log.info('DATA: '+c.remoteAddress);
        processDataServer(data, c);
    });

});
server.on('end', function() {
  log.warn('END server');
});

server.on('error', function(err) {
  log.error('SERVER: '+err);
});

server.listen(clientInfo.port, function(){
    log.info('Listening to: '+clientInfo.port);

    client = net.connect(connection, function(){
        log.info('Connected');
        loginRequest();
    });
    client.on('data', function(data) {
      console.log('-------------------------------------------');
      processDataClient(data);
    });

    client.on('end', function() {
      log.warn('END client');
    });

    client.on('error', function(err) {
      log.error('CLIENT: '+err);
    });

});


var loginRequest = function() {
    log.info('login request');
    var pack = [
        [TYPE_UINT8, OP_LOGINREQUEST],
        [TYPE_HASH, clientInfo.hash],
        [TYPE_UINT32, clientInfo.id],
        [TYPE_UINT16, clientInfo.port],
        [TYPE_TAGS, [
            [TYPE_STRING, TAG_NAME, 'foobar 2313'],
            [TYPE_UINT32, TAG_VERSION, 60],
            [TYPE_UINT32, TAG_FLAGS, 0], // 1817
            [TYPE_UINT32, TAG_MULEVERSION, 51200],
        ]],
    ];
    client.write(Packet.make(PR_ED2K, pack), errorHandler);
};

var processDataServer = function(data, c) {
    console.log('===========================================');
    var protocol = data.getUInt8();
    var size = data.getUInt32LE();
    var opcode = data.getUInt8();

    opServer(opcode, data.get(size-1), size, c);
}

var opServer = function(opcode, data, size, c) {
    switch (opcode) {
        case OP_HELLO:
            log.info('OP_HELLO '+size);
            var op = {};
            op.hashSize = data.getUInt8();
            op.hash = data.get(op.hashSize);
            op.clientId = data.getUInt32LE();
            op.tcpPort = data.getUInt16LE();
            op.tags = [];
            data.getTags(function(tag){op.tags.push(tag);});
            console.dir(op);
            excess(data);
            pack = [
                [TYPE_UINT8, OP_HELLO],
                [TYPE_UINT8, 16],
                [TYPE_HASH, clientInfo.hash],
                [TYPE_UINT32, clientInfo.id],
                [TYPE_UINT16, clientInfo.port],
                [TYPE_TAGS, [
                    [TYPE_STRING, TAG_NAME, 'eNode'],
                    [TYPE_UINT32, TAG_VERSION, 1],
                ]],
            ]
            console.dir(pack);
            c.write(Packet.make(PR_ED2K, pack), errorHandler);
            break;
        default:
            return;
    }
}

var processDataClient = function(data) {
    console.log('-------------------------------------------');
    //console.log(hexDump(data));

    var protocol = data.getUInt8();
    var size = data.getUInt32LE();
    var opcode = data.getUInt8();

    if (protocol == PR_ZLIB) {
        zlib.unzip(data.get(size-1), function(err, buffer) {
            if (!err) {
                log.debug('unzip');
                opClient(opcode, buffer, buffer.length);
            }
            else log.error('Cannot unzip: operation 0x'+opcode.toString(16));
        });
        return;
    }
    else if (protocol != PR_ED2K) {
        log.error('PROTO: 0x'+protocol.toString(16));
        return;
    }

    opClient(opcode, data, size);
};

var opClient = function(opcode, data, size) {

    switch (opcode) {
        case OP_IDCHANGE: // 0x40
            log.info('OP_IDCHANGE '+size);
            var d = data.get(size-1);
            var id = d.getUInt32LE();
            log.trace('ID: 0x'+id.toString(16));
            if (d.length > 4) {
                var flags = d.getUInt32LE();
                log.trace('FLAGS: '+id.toString(2));
            }
            excess(d);
            break;
        case OP_SERVERSTATUS: // 0x34
            log.info('OP_SERVERSTATUS '+size);
            var d = data.get(size-1);
            var users = d.getUInt32LE();
            var files = d.getUInt32LE();
            log.trace('USERS: '+users);
            log.trace('FILES: '+files);
            excess(d);
            break;
        case OP_SERVERMESSAGE: // 0x38
            log.info('OP_SERVERMESSAGE '+size);
            var d = data.get(size-1);
            var msg = new Buffer(d.getString(), 'binary');
            log.trace('MSG: '+msg.toString('utf8'));
            excess(d);
            break;
        default:
            log.error('SIZE: '+size+' bytes');
            log.error('OPCODE: 0x'+opcode.toString(16));
            return;
    };

    if (data.pos() < data.length-5) {
        log.debug('MORE...');
        processDataClient(data.get());
    }

}

var errorHandler = function(err) {
    if (!err) return;
    log.error(err);
}

var excess = function(data) {
    if (data.pos() < data.length) {
        var d = data.get();
        log.warn('Excess data: '+d.length);
        console.log(hexDump(d));
    }
}

