var	Ed2kMessage = require('./ed2k-message.js').Ed2kMessage,
	log = require('tinylogger'),
	hexDump = require('hexy').hexy,
	config = require('../enode.config.js').config,
	zlib = require('zlib'),
	helpers = require('./helpers.js');


var OP = {
	LOGIN_REQUEST: 		0x01, // aka HELLO
	// HELLO_ANSWER: 		0x4c,
	REJECT:				0x05,
	// GET_SERVER_LIST: 	0x14,
	OFFER_FILES: 		0x15,
	// SEARCH_REQUEST: 	0x16,
	// GET_SOURCES: 		0x19,
	// CALLBACK_REQUEST: 	0x1c,
	// GET_SOURCES_OBFU: 	0x23,
	// SERVER_LIST: 		0x32,
	// SEARCH_RESULT: 		0x33,
	SERVER_STATUS: 		0x34,
	// CALLBACK_REQUESTED: 0x35,
	// CALLBACK_FAILED: 	0x36,
	SERVER_MESSAGE: 	0x38,
	ID_CHANGE: 			0x40,
	SERVER_IDENT: 		0x41,
	// FOUND_SOURCES: 		0x42,
	// FOUND_SOURCES_OBFU: 0x44
}

var operations = [];
var responses = [];

/**
 * Dispatch message
 *
 * @param {Ed2kClient}  client
 * @param {Ed2kMessage} message
 * @param {Function}    callback(Ed2kMessage)
 */
var dispatch = function(client, message, callback) {
	var opcode = message.readOpcode(); // also seeks message position to 5
	log.debug('Ed2kTcpOperations.dispatch: 0x' + opcode + ' ' + client.toString());
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
			log.trace('Ed2kTcpOperations.preProcess: unzipping message');
			if (err) {
				log.error('Ed2kTcpOperations.preProcess: Error unzipping message');
			} else {
				log.trace('Ed2kTcpOperations.preProcess: unzip ok! (' + data.length + ' bytes)\n' + hexDump(data.slice(0, 64)));
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
 * @param {Ed2kClient} client
 * @param {Ed2kMessage} message
 * @param {Function} callback(Ed2kMessage)
 */
operations[OP.LOGIN_REQUEST] = function (client, message, callback) {
	log.trace('Ed2kTcpOperations.operations[LOGIN_REQUEST]');
	var response = new Ed2kMessage(),
		request;

	if (client.status == CS.NOT_LOGGED) {
		request = {
			hash: message.readHash(),
			id: message.readUInt32LE(),
			port: message.readUInt16LE(),
			tags: message.readTags()
		}
		log.trace('+ Login request: ' + JSON.stringify(request));
		response.writeMessage(responses[OP.SERVER_MESSAGE]('server version ' + config.versionString + ' (eNode)'));
		response.writeMessage(responses[OP.SERVER_MESSAGE](config.messageLogin));
		response.writeMessage(responses[OP.SERVER_STATUS]());
		response.writeMessage(responses[OP.ID_CHANGE](client));
		response.writeMessage(responses[OP.SERVER_IDENT]());
	} else {
		response = responses[OP.REJECT]();
		client.status = CS.CONNECTION_CLOSE;
	}
	callback(response);
}

/**
 * Offer files
 *
 * @param {Ed2kClient} client
 * @param {Ed2kMessage} message
 * @param {Function} callback(null)
 */
operations[OP.OFFER_FILES] = function (client, message, callback) {
	var count = message.readUInt32LE(),
		file, id, port;

	log.trace('Ed2kTcpOperations.operations[OFFER_FILES]: Got ' + count + ' files.');

	while (count--) {
		file = {
			hash: message.readHash(),
			complete: true,
		}
		id = message.readUInt32LE();
		port = message.readUInt16LE();
		file.complete = (id == FILE.COMPLETE_ID && port == FILE.COMPLETE_PORT) ? true : false;
		message.readTags(function (tag) {
			file[tag[0]] = tag[1];
		});
		file.SIZE_LO = file.SIZE;
		if (file.SIZE_HI) {
			file.SIZE+= file.SIZE_HI * 0x100000000;
		} else file.SIZE_HI = 0;
		//log.trace(JSON.stringify(file));
		//log.trace(JSON.stringify(file.NAME.substr(0, 50)));
	}
	callback(null);
}

/**
 * Reject Message
 *
 * @return {Ed2kMessage}
 */
responses[OP.REJECT] = function () {
	log.trace('Ed2kTcpOperations.responses[OP.REJECT]')
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
	log.trace('Ed2kTcpOperations.responses[OP.SERVER_MESSAGE]')
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
	log.trace('Ed2kTcpOperations.responses[OP.SERVER_STATUS]')
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
	log.trace('Ed2kTcpOperations.responses[OP.ID_CHANGE]')
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
	log.trace('Ed2kTcpOperations.responses[OP.SERVER_IDENT]')
	return Ed2kMessage.serialize([
		[TYPE.UINT8, OP.SERVER_IDENT],
		[TYPE.HASH, config.hash],
		[TYPE.UINT32, helpers.Ip4toInt32LE(config.address)],
		[TYPE.UINT16, config.tcp.port],
		[TYPE.TAGS, [
			[TYPE.STRING, TAG.NAME, config.name],
			[TYPE.STRING, TAG.DESCRIPTION, config.description]
		]],
	]);
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
//exports.TCP_OPCODES = OP;