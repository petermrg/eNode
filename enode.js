#!/usr/bin/env node

require('./ed2k/globals.js');

var ed2kTCPServer = require('./ed2k/tcpserver.js');
var ed2kUDPServer = require('./ed2k/udpserver.js');
var storage       = require('./storage/storage.js');

storage.init(function(){
    ed2kTCPServer.run(function(){
        ed2kUDPServer.run();
    });
});
