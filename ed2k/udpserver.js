var dgram = require('dgram');
var conf = require('../enode.config.js').config;
var log = require('tinylogger');
var op = require('./udpoperations.js');

exports.run = function(enableCrypt, port) {

    var udpServer = dgram.createSocket('udp4');

    udpServer.on('message', function(data, info){
        log.debug('UDP data. '+info.size+'bytes');
        var buffer = new Buffer(data); // this step should be removed in later versions of node.js
        op.processData(buffer, info, udpServer);
    });

    udpServer.on('listening', function(){
        var address = udpServer.address();
        log.ok('Listening to UDP: '+port);
        if (enableCrypt) log.todo('UDP obfuscation');
    });

    udpServer.on('error', function(err){
        log.error('UDP error: '+err);
    });

    udpServer.bind(port);

};

function updateConfig() {
    conf.udp.flags =
        FLAG_NEWTAGS + FLAG_UNICODE + FLAG_LARGEFILES +
        (conf.udp.getSources ? (FLAG_UDP_EXTGETSOURCES+FLAG_UDP_EXTGETSOURCES2) : 0) +
        (conf.udp.getFiles ? FLAG_UDP_EXTGETFILES : 0) +
        (conf.supportCrypt ? FLAG_UDP_OBFUSCATION : 0) +
        (conf.supportCrypt ? FLAG_TCP_OBFUSCATION : 0);
    log.info('UDP flags: 0x'+conf.udp.flags.toString(16)+' - '+conf.udp.flags.toString(2));
}
updateConfig();
