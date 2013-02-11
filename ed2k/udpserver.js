var dgram = require('dgram');
var conf = require('../enode.config.js').config;
var log = require('tinylogger');
var op = require('./udpoperations.js');

var udpServer = dgram.createSocket('udp4');

exports.run = function() {

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

};
