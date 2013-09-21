var dgram = require('dgram');
var log = require('tinylogger');
var hex = require('hexy').hexy;

var udp = dgram.createSocket('udp4');

require('../ed2k/globals.js');
var Packet = require('../ed2k/packet.js').Packet;

var port = 5559;
var ip = '192.168.3.109';

var port = 1176+4;
var ip = '91.200.42.46';

udp.on('message', function(data, info){
    log.info('data!!!!');
    console.log(info);
    var buffer = new Buffer(data);
    console.log(hex(buffer));
});

udp.on('listening', function(){
    var address = udp.address();
    log.ok('Listening to UDP: '+port);
    var buffer = new Buffer(Packet.makeUDP(PR_ED2K, [
        [TYPE_UINT8, OP_GLOBSERVSTATREQ],
        [TYPE_UINT32, 0xff00ff00],
    ]));
    log.info('send');
    console.log(hex(buffer));
    udp.send(buffer, 0, buffer.length, port, ip, function(err){
        if (err) { log.error(err); }
        else log.ok('udp msg sended')
    });
});
//ed2k://|server|91.200.42.46|1176|/
udp.on('error', function(err){
    log.error('UDP error: '+err);
});

udp.bind(6543);


