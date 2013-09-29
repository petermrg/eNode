var net = require('net');

var count = 0;

var i = 10;
var makeConnection = function() {

    var c = net.connect(5555, '127.0.0.1', function(){
        count++;
        console.log(count);
        makeConnection()
        //c.end();
    }).on('error', function(err){
        console.log(err);
    }).on('data', function(data){

    }).on('end', function(){

    });

}

makeConnection();
