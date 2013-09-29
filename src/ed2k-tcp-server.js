require('./ed2k-globals.js');

var config = require('../enode.config.js'),
	net = require('net'),
	log = require('tinylogger'),
	Ed2kMessage = require('./ed2k-message.js'),
	Ed2kTcpStream = require('./ed2k-tcp-stream.js'),
	Ed2kTcpOperations = require('./ed2k-tcp-operations.js'),
	Ed2kClient = require('./ed2k-client.js'),
	Storage = require('./storage-' + config.storage.engine + '.js'), // remove this when no longer needed!
	crypt = require('./crypt.js'),
	hexDump = require('hexy').hexy,
	async = require('async')

var Ed2kTcpServer = function(port) {
	this.port = port;
}

Ed2kTcpServer.prototype.start = function() {
	var self = this;
	this.server = net.createServer(connectionHandler);
	this.server.listen(self.port, function() {
		log.ok('TcpServer: listening to: ' + self.port);
	});

	// the following startup code should be moved out of here
	config.hash = crypt.md5(config.address + config.tcp.port);
	config.tcp.flags =
		FLAG.ZLIB +
		FLAG.NEW_TAGS +
		FLAG.UNICODE +
		FLAG.LARGE_FILES +
		(config.auxiliarPort ? FLAG.AUX_PORT : 0) +
		(config.requireCrypt ? FLAG.REQUIRE_CRYPT : 0) +
		(config.requestCrypt ? FLAG.REQUEST_CRYPT : 0) +
		(config.supportCrypt ? FLAG.SUPPORT_CRYPT : 0) +
		(config.IpInLogin ? FLAG.IP_IN_LOGIN : 0);
	log.info('eNode ' + config.versionString);
	log.info('Server hash: ' + config.hash.toString('hex'));
	log.info('TCP flags: 0x' + config.tcp.flags.toString(16) + ' - ' + config.tcp.flags.toString(2));

	if (config.storage.returnSourcesLimit > 256) {
		config.storage.returnSourcesLimit = 256;
		log.warn('Set config.storage.returnSourcesLimit to 256');
	}
};

var connectionHandler = function (connection) {

	var client = new Ed2kClient(connection.remoteAddress, connection.remotePort),
		stream = new Ed2kTcpStream(),
		response = new Ed2kMessage();

	log.debug('TcpServer: new connection: ' + client);

	connection.on('data', function(data) {
		log.info('Ed2kTcpServer.connectionHandler: data from ' + client.toString() + ' (' + data.length + ' bytes)');

		stream.append(client, data);

		// async.reduce(array, initialValue, function(initialValue, arrayItem, callback(err, result)))
		async.reduce(stream.parse(), response, function(response, message, callback){
			// Pre-process message (unzip if needed)
			Ed2kTcpOperations.preProcessMessage(message, function (message) {
				Ed2kTcpOperations.dispatch(client, message, function(result) {
					if (result) {
						response.writeMessage(result);
					}
					callback(null, response); // err, result
				});
			});
		}, function(err, response) {
			if (response && response.tell() > 0) {
				connection.write(response.getBuffer());
				// log.trace('Ed2kTcpServer.connectionHandler response to ' + client.toString() + '\n' + hexDump(response.getBuffer()));
				response.reset();
			}
			if (client.status == CS.CONNECTION_CLOSE) {
				connection.end();
			}
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

Storage.connect(function() {
	var server = new Ed2kTcpServer(config.tcp.port);
	server.start();
});


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