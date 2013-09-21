var dgram = require('dgram');

var server = dgram.createSocket('udp4');

var recv = 0;
server.on('message', function (msg, rinfo) {
    recv++;
});
setInterval(function(){
    log.trace('udp packets/s :'+recv+'/'+sent);
    recv = 0;
    sent = 0;
}, 1000);

server.on('listening', function () {
  var address = server.address();
  log.trace('server listening ' +
      address.address + ':' + address.port);
});

server.bind(5575);
// server listening 0.0.0.0:5555

var dgram2 = require('dgram');
var message = new Buffer("ping");
var client = dgram.createSocket("udp4");

var sent = 0;
function udpsend() {
    client.send(message, 0, message.length, 5575, "localhost", function(err, bytes) {
    sent++;
        udpsend();
    });
}
udpsend();
