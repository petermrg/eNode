var dgram = require('dgram');
var conf = require('../enode.config.js').config;
var log = require('tinylogger');
var op = require('./udpoperations.js');

exports.run = function() {

    var udpServer = dgram.createSocket('udp4');
    op.setUdpServer(udpServer);

    udpServer.on('message', function(data, info){
        var buffer = new Buffer(data); // this step should be removed in later versions of node.js
        op.processData(buffer, info);
    });

    udpServer.on('listening', function(){
        var address = udpServer.address();
        log.ok('Listening to UDP: '+conf.udp.port);
    });

    udpServer.on('error', function(err){
        log.error('UDP error: '+err);
    });

    udpServer.bind(conf.udp.port);

// OBFUSCATED SERVER

    var udpObfuscated = dgram.createSocket('udp4');
    //op.setUdpServer(udpObfuscated);

    udpObfuscated.on('message', function(data, info){
        var buffer = new Buffer(data); // this step should be removed in later versions of node.js
        log.info('UDP Obf. data');
        op.processData(buffer, info);
    });

    udpObfuscated.on('listening', function(){
        var address = udpObfuscated.address();
        log.ok('Listening to UDP: '+conf.udp.portObfuscated+' (Obfuscated)');
    });

    udpObfuscated.on('error', function(err){
        log.error('UDP Obf. error: '+err);
    });

    udpObfuscated.bind(conf.udp.portObfuscated);

};

