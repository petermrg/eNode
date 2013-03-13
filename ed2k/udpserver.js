var dgram = require('dgram');
var conf = require('../enode.config.js').config;
var log = require('tinylogger');
var op = require('./udpoperations.js');
var udpCrypt = require('./udpcrypt.js').udpCrypt;

exports.run = function(enableCrypt, port) {

    var udpServer = dgram.createSocket('udp4');

    udpServer.on('listening', function(){
        log.ok('Listening to UDP: '+port);
    });

    udpServer.on('error', function(err){
        log.error('UDP error: '+err);
    });

    if (enableCrypt) {
        udpServer.crypt = new udpCrypt();
        udpServer.on('message', function(data, info){
            log.trace('UDP data: '+info.size+' bytes (encrypted port)');
            data = udpServer.crypt.decrypt(data, info);
            op.processData(data, info, udpServer);
        });
    }
    else {
        udpServer.crypt = false;
        udpServer.on('message', function(data, info){
            log.trace('UDP data: '+info.size+' bytes');
            op.processData(data, info, udpServer);
        });
    }

    udpServer.bind(port);

};

(function updateConfig() {
    conf.udp.flags =
        FLAG_NEWTAGS +
        FLAG_UNICODE +
        FLAG_LARGEFILES +
        (conf.udp.getSources ? (FLAG_UDP_EXTGETSOURCES + FLAG_UDP_EXTGETSOURCES2) : 0) +
        (conf.udp.getFiles ? FLAG_UDP_EXTGETFILES : 0) +
        (conf.supportCrypt ? FLAG_UDP_OBFUSCATION : 0) +
        (conf.supportCrypt ? FLAG_TCP_OBFUSCATION : 0);
    log.info('UDP flags: 0x'+conf.udp.flags.toString(16)+' - '+conf.udp.flags.toString(2));
})();
