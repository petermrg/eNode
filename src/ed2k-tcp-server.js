var net = require('net'),
	log = require('tinylogger'),
	Ed2kTcpStream = require('./ed2k-tcp-stream.js').Ed2kTcpStream,
	Ed2kTcpClient = require('./ed2k-tcp-client.js').Ed2kTcpClient,
	Ed2kTcpOperations = require('./ed2k-tcp-operations.js');

var Ed2kTcpServer = function(port) {
	this.port = port;
}

Ed2kTcpServer.prototype.start = function() {

	var self = this;

	this.server = net.createServer(connectionHandler);

	this.server.listen(self.port, function() {
		log.ok('TcpServer: listening to: ' + self.port);
	});

};

var connectionHandler = function (connection) {

	var client = new Ed2kTcpClient(connection.remoteAddress, connection.remotePort),
		stream = new Ed2kTcpStream(),
		response;

	log.debug('TcpServer: new connection: ' + client);

	connection.on('data', function(data) {
		stream.append(client.status, data);
		stream.parse().forEach(function(message) {
			response = Ed2kTcpOperations.dispatch(message);
			log.debug(response);
		});
	});

	connection.on('error', function (err) {
		log.error('Client socket error.' + err);
	});

	// FIN packet received
	connection.on('end', function () {
		log.debug('TcpServer: connection end: ' + client);
	});

	connection.on('close', function (hadError) {
		log.debug('TcpServer: connection close. [error: ' + hadError + '] ' + client);
		delete client;
	});

};

exports.Ed2kTcpServer = Ed2kTcpServer;

var server = new Ed2kTcpServer(1234);

server.start(1234);


/*
	var server = net.createServer(function(client) {
		client.info = {
			ipv4: misc.IPv4toInt32LE(client.remoteAddress),
			logged: false,
			storageId: -1,
			id: -1,
			hasLowId: true,
		}
		log.info('Connect: '+client.info.ipv4)
		client.packet = new Packet(client)

		if (enableCrypt) {
			client.crypt = new TcpCrypt(client.packet)
			client.on('data', function(data) {
				data = client.crypt.decrypt(data)
				op.processData(data, client)
			})
		}
		else {
			client.crypt = false
			client.on('data', function(data) {
				op.processData(data, client)
			})
		}

		client.on('end', function() {
			log.alert('Client socket end: '+client.info.storageId)
		})

		client.on('close', function() {
			log.alert('Client socket close: '+client.info.storageId)
			if (client.info.hasLowId) lowIdClients.remove(client.info.id)
			db.clients.disconnect(client.info)
		})

		client.on('error', function(err) {
			log.error('Client socket error.'+err)
			console.dir(err)
			console.dir(client)
			client.end()
		})

	})

	server.on('error', function(err) {
		switch (err.code) {
			case 'EADDRNOTAVAIL':
				log.panic('Address '+conf.address+' not available.')
				process.exit()
				break
			default: log.error('Server error: '+JSON.stringify(err))
		}
	})

	server.listen(port, conf.address, 511, function() {
		server.maxConnections = conf.tcp.maxConnections
		log.ok('Listening to TCP: '+port+' (Max connections: '+
			server.maxConnections+')')
		if (typeof callback == 'function') { callback() }
	})

}

;(function updateConfig() {
	console.log(misc.box(ENODE_NAME+' '+ENODE_VERSIONSTR))

	conf.hash = crypt.md5(conf.address+conf.tcp.port)
	log.info('Server hash: '+conf.hash.toString('hex'))

	conf.tcp.flags =
		FLAG_ZLIB +
		FLAG_NEWTAGS +
		FLAG_UNICODE +
		FLAG_LARGEFILES +
		(conf.auxiliarPort ? FLAG_AUXPORT : 0) +
		(conf.requireCrypt ? FLAG_REQUIRECRYPT : 0) +
		(conf.requestCrypt ? FLAG_REQUESTCRYPT : 0) +
		(conf.supportCrypt ? FLAG_SUPPORTCRYPT : 0) +
		(conf.IPinLogin ? FLAG_IPINLOGIN : 0)
	log.info('TCP flags: 0x'+conf.tcp.flags.toString(16)+' - '+
		conf.tcp.flags.toString(2))

})()


*/