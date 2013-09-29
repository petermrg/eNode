require('./ed2k-globals.js');

var	Ed2kMessage = require('./ed2k-message.js'),
	log = require('tinylogger'),
	hexDump = require('hexy').hexy,
	config = require('../enode.config.js'),
	zlib = require('zlib'),
	helpers = require('./helpers.js'),
	Storage = require('./storage-' + config.storage.engine + '.js'),
	Ed2kFile = require('./ed2k-file.js');

var operations = [],
	responses = [];

/**
 * Dispatch message
 *
 * @param {Ed2kClient}	client
 * @param {Ed2kMessage} message
 * @param {Function}	callback(Ed2kMessage)
 */
var dispatch = function(client, message, callback) {
	var opcode = message.readOpcode(); // also seeks message position to 5
	// log.debug('Ed2kTcpOperations.dispatch: 0x' + opcode + ' ' + client.toString());
	operations[opcode](client, message, function(response) {
		if (message.getSizeLeft() > 0) {
			log.error('loginRequest: remaining data in message');
		}
		callback(response);
	});
};

/**
 * Preprocess a message
 *
 * @param {Ed2kMessage} message
 * @param {Function}    callback(Ed2kMessage)
 */
var preProcessMessage = function(message, callback) {
	message.reset();
	// check for compressed message
	if (message.readUInt8() == PR.ZLIB) {
		zlib.unzip(message._buffer.slice(6), function (err, data) {
			// log.trace('Ed2kTcpOperations.preProcess: unzipping message');
			if (err) {
				log.error('Ed2kTcpOperations.preProcess: Error unzipping message');
			} else {
				// log.trace('Ed2kTcpOperations.preProcess: unzip ok! (' + data.length + ' bytes)\n' + hexDump(data.slice(0, 64)));
				unzipped = new Buffer(data.length + 6);
				message._buffer.copy(unzipped, 0, 0, 6);
				data.copy(unzipped, 6, 0, data.length);
				message._buffer = unzipped;
				message._buffer[0] = PR.ED2K;
				callback(message);
			}
		});
	} else {
		message.end();
		callback(message);
	}
};

/**
 * Login request
 *
 * @param {Ed2kClient}  client
 * @param {Ed2kMessage} message
 * @param {Function}    callback(Ed2kMessage)
 */
operations[OP.LOGIN_REQUEST] = function (client, message, callback) {
	log.trace('LOGIN_REQUEST');

	client.hash = message.readHash();
	client.id = message.readUInt32LE();
	client.port = message.readUInt16LE();
	message.readTags(function(tag) {
		client[tag[0]] = tag[1];
	});

	if (client.status == CS.NOT_LOGGED) {
		Storage.clients.isConnected(client, function (err, connected) {
			var response = new Ed2kMessage();
			if (!connected) {
				log.trace('+ Login request: ' + JSON.stringify(client));
				response.writeMessage(responses[OP.SERVER_MESSAGE]('server version ' + config.versionString + ' (eNode)'));
				response.writeMessage(responses[OP.SERVER_MESSAGE](config.messageLogin));
				response.writeMessage(responses[OP.SERVER_STATUS]());
				response.writeMessage(responses[OP.ID_CHANGE](client));
				response.writeMessage(responses[OP.SERVER_IDENT]());
				callback(response);
			} else {
				client.status = CS.CONNECTION_CLOSE;
				callback(responses[OP.SERVER_MESSAGE]('A client with the same hash is already connected. Closing connection.'));
			}
		});
	} else {
		callback(responses[OP.SERVER_MESSAGE]('You are already connected.'));
	}
}

/*
handShake: function(client) {
	db.clients.connect(client.info, function(err, storageId) {
		if (!err) {
			client.info.logged = true
			log.info('Storage ID: '+storageId)
			client.info.storageId = storageId
			send.serverMessage(conf.messageLogin, client)
			send.serverMessage('server version '+ENODE_VERSIONSTR+' ('+ENODE_NAME+')', client)
			send.serverStatus(client)
			send.idChange(client.info.id, client)
			send.serverIdent(client)
		}
		else {
			log.error(err)
			//send.serverMessage(clientStorage.message, client)
			log.todo('handShake: send reject command')
			//client.end()
		}
	})
},

loginRequest: function(client) {
	log.debug('LOGINREQUEST < '+client.info.ipv4)
	var data = client.message.data
	db.clients.isConnected(client.info, function(err, connected) {
		if (err) {
			log.error('loginRequest: '+err)
			client.end()
			return
		}
		if (connected) {
			log.error('loginRequest: already connected')
			client.end()
			return
		}
		isFirewalled(client, conf.supportCrypt, function(firewalled) {
			if (firewalled) {
				client.info.hasLowId = true
				send.serverMessage(conf.messageLowID, client)
				client.info.id = lowIdClients.add(client)
				if (client.info.id != false) {
					receive.handShake(client)
					log.info('Assign LowId: '+client.info.id)
				}
				else { client.end() }
			}
			else {
				client.info.hasLowId = false
				client.info.id = client.info.ipv4
				client.info.hasLowId = false
				receive.handShake(client)
				log.info('Assign HighID: '+client.info.id)
			}
		})
	})
},
*/
/**
 * Offer files
 *
 * @param {Ed2kClient}  client
 * @param {Ed2kMessage} message
 */
operations[OP.OFFER_FILES] = function (client, message) {
	var count = message.readUInt32LE(),
		file, id, port;
	log.trace('OFFER_FILES: Got ' + count + ' files.');
	while (count--) {
		file = Ed2kFile.readFromMessage(client, message);
		Storage.files.addSource(client, file, null);
	}
}

/**
 * Get Server List
 *
 * @param {Ed2kClient}  client
 * @param {Ed2kMessage} message
 * @param {Function}    callback(err, Ed2kMessage)
 */
operations[OP.GET_SERVER_LIST] = function (client, message, callback) {
	log.trace('GET_SERVER_LIST: not implemented!');
	callback(null, null);
}

/**
 * Get Sources Obfuscated. Supposes that client supports largefiles.
 *
 * @param {Ed2kClient}  client
 * @param {Ed2kMessage} message
 * @param {Function}    callback(err, Ed2kMessage)
 */
operations[OP.GET_SOURCES_OBFU] = function (client, message, callback) {
	var file = new Ed2kFile();

	file.hash = message.readHash();
	file.size = message.readUInt32LE();

	// large file? read 64 bits
	if (file.size == 0) {
		file.size = message.readUInt32LE();
		file.sizeHi = message.readUInt32LE();
	}
	log.trace('GET_SOURCES_OBFU: ' + file.hash.toString('hex'));
	Storage.files.getSources(client, file, function(err, files) {
		if (!err) {
			if (files.length > 0) {
				callback(err, responses[OP.FOUND_SOURCES_OBFU](files));
			} else {
				callback(err, null);
			}
		}
		else {
			log.error('GET_SOURCES_OBFU: ' + err);
		}
	});
}

/**
 * Get Sources. Supposes that client supports largefiles.
 *
 * @param {Ed2kClient}  client
 * @param {Ed2kMessage} message
 * @param {Function}    callback(err, Ed2kMessage)
 */
operations[OP.GET_SOURCES] = function (client, message, callback) {
	var file = new Ed2kFile();

	file.hash = message.readHash();
	file.size = message.readUInt32LE();

	// large file? read 64 bits
	if (file.size == 0) {
		file.size = message.readUInt32LE();
		file.sizeHi = message.readUInt32LE();
	}
	log.trace('GET_SOURCES: ' + file.hash.toString('hex'));
	Storage.files.getSources(client, file, function(err, files) {
		if (!err) {
			if (files.length > 0) {
				callback(err, responses[OP.FOUND_SOURCES](files));
			} else {
				callback(err, null);
			}
		}
		else {
			log.error('GET_SOURCES: ' + err);
		}
	});
}

/**
 * Found sources
 *
 * @param  {Array} files { id, port }
 * @return {Ed2kMessage}
 */
responses[OP.FOUND_SOURCES] = function (files) {
	var data = [
		[TYPE.UINT8, OP.FOUND_SOURCES],
		[TYPE.HASH, file.hash],
		[TYPE.UINT8, files.length],
	];
	files.forEach(function (file) {
		data.push([TYPE.UINT32, file.id]);
		data.push([TYPE.UINT16, file.port]);
	});
	return Ed2kMessage.serialize(data);
}

/**
 * Found sources obfuscated
 *
 * @param  {Array} files { id, port }
 * @return {Ed2kMessage}
 * @todo add client obfuscated data
 */
responses[OP.FOUND_SOURCES_OBFU] = function (file) {
	log.warn('OP.FOUND_SOURCES_OBFU not implemented, returning OP.FOUND_SOURCES');
	return responses[OP.FOUND_SOURCES](file);
}

/**
 * Reject Message
 *
 * @return {Ed2kMessage}
 */
responses[OP.REJECT] = function () {
	log.trace('REJECT')
	return Ed2kMessage.serialize([
		[TYPE.UINT8, OP.REJECT],
	]);
}

/**
 * Server Message
 *
 * @param	{String} text Server message
 * @return {Ed2kMessage}
 */
responses[OP.SERVER_MESSAGE] = function (text) {
	log.trace('SERVER_MESSAGE')
	return Ed2kMessage.serialize([
		[TYPE.UINT8, OP.SERVER_MESSAGE],
		[TYPE.STRING, text],
	]);
}

/**
 * Server Status
 *
 * @return {Ed2kMessage}
 */
responses[OP.SERVER_STATUS] = function () {
	log.trace('SERVER_STATUS')
	return Ed2kMessage.serialize([
		[TYPE.UINT8, OP.SERVER_STATUS],
		[TYPE.UINT32, 1111], // clients count
		[TYPE.UINT32, 2222] // files count
	]);
}

/**
 * ID Change
 *
 * @return {Ed2kMessage}
 */
responses[OP.ID_CHANGE] = function (client) {
	log.trace('ID_CHANGE')
	return Ed2kMessage.serialize([
		[TYPE.UINT8, OP.ID_CHANGE],
		[TYPE.UINT32, client.id],
		[TYPE.UINT32, config.tcp.flags]
	]);
}

/**
 * Server Ident
 *
 * @return {Ed2kMessage}
 */
responses[OP.SERVER_IDENT] = function () {
	log.trace('SERVER_IDENT')
	return Ed2kMessage.serialize([
		[TYPE.UINT8, OP.SERVER_IDENT],
		[TYPE.HASH, config.hash],
		[TYPE.UINT32, helpers.Ip4toInt32LE(config.address)],
		[TYPE.UINT16, config.tcp.port],
		[TYPE.TAGS, [
			[TYPE.STRING, TAG.name, config.name],
			[TYPE.STRING, TAG.description, config.description]
		]],
	]);
}

;(function() {
	// Assign a fallback function to unhandled operations
	var noop = function (client, message, callback) {
		log.warn('Unhandled opcode: 0x' + message.readOpcode().toString(16) + '\n' + hexDump(message._buffer.slice(0, 256)));
		message.end();
		callback(responses[OP.REJECT]());
	}
	for (var i = 0; i < 256; i++) {
		operations[i] = operations[i] || noop;
		responses[i] = responses[i] || noop;
	}
})();

exports.dispatch = dispatch;
exports.preProcessMessage = preProcessMessage;
