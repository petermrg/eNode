#!/usr/bin/env node

require('./ed2k/globals.js');

var ed2kTCPServer = require('./ed2k/tcpserver.js');
var ed2kUDPServer = require('./ed2k/udpserver.js');
var storage       = require('./storage/storage.js');
var conf          = require('./enode.config.js').config;

storage.init(function(){

    ed2kTCPServer.run(false, conf.tcp.port, function(){
        ed2kUDPServer.run(false, conf.udp.port);
    });

    if (conf.supportCrypt) {
        ed2kTCPServer.run(true, conf.tcp.portObfuscated, function(){
            ed2kUDPServer.run(true, conf.udp.portObfuscated);
        });
    }

});
