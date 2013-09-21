var	Ed2kMessage = require('./ed2k-message.js').Ed2kMessage,
	log = require('tinylogger'),
	hexDump = require('hexy').hexy,
	config = require('../enode.config.js').config,
	helpers = require('./helpers.js');

var OP = {
	LOGIN_REQUEST: 		0x01, // aka HELLO
	// HELLO_ANSWER: 		0x4c,
	REJECT:  			0x05,
	SERVER_MESSAGE: 	0x38,
	SERVER_STATUS: 		0x34,
	ID_CHANGE: 			0x40,
	// GET_SERVER_LIST: 	0x14,
	// OFFER_FILES: 		0x15,
	// SERVER_LIST: 		0x32,
	SERVER_IDENT: 		0x41,
	// GET_SOURCES: 		0x19,
	// FOUND_SOURCES: 		0x42,
	// SEARCH_REQUEST: 	0x16,
	// SEARCH_RESULT: 		0x33,
	// CALLBACK_REQUEST: 	0x1c,
	// CALLBACK_REQUESTED: 0x35,
	// CALLBACK_FAILED: 	0x36,
	// GET_SOURCES_OBFU: 	0x23,
	// FOUND_SOURCES_OBFU: 0x44
}

var operations = [];
var responses = [];
/**
 * Dispatch message
 *
 * @param  {Ed2kClient} client
 * @param  {Ed2kMessage} message
 * @return {Ed2kMessage} response
 */
var dispatch = function(client, message) {
	log.trace('Ed2kTcpOperations.dispatch\n' + hexDump(message._buffer));
	var opcode = message.readOpcode();
	var response = operations[opcode](client, message);
	if (message.getSizeLeft() > 0) {
		log.error('loginRequest: remaining data in message');
	}
	return response;
};

/**
 * Login request
 *
 * @param  {Ed2kClient} client
 * @param  {Ed2kMessage} message
 * @return {Ed2kMessage}
 */
operations[OP.LOGIN_REQUEST] = function (client, message) {
	log.trace('Ed2kTcpOperations.loginRequest');
	var response = new Ed2kMessage(),
		request;

	if (client.status == CS.NOT_LOGGED) {
		request = {
			hash: message.readHash(),
			id: message.readUInt32LE(),
			port: message.readUInt16LE(),
			tags: message.readTags()
		}
		response.writeMessage(responses[OP.SERVER_MESSAGE](config.messageLogin));
		response.writeMessage(responses[OP.SERVER_MESSAGE]('server version ' + config.versionString + ' (eNode)'));
		response.writeMessage(responses[OP.SERVER_STATUS]());
		response.writeMessage(responses[OP.ID_CHANGE](client));
		response.writeMessage(responses[OP.SERVER_IDENT]());
	} else {
		response = responses[OP.REJECT]();
		client.status = CS.CONNECTION_CLOSE;
	}
	return response;
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
 * @param  {String} text Server message
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

/**
 * Assign a fallback function to unhandled operations
 */
;(function() {
	var noop = function (client, message) {
		log.warn('Unhandled opcode: 0x' + message.readOpcode().toString(16));
		message.end();
		return responses[OP.REJECT]();
	}
	for (var i = 0; i < 256; i++) {
		operations[i] = operations[i] || noop;
		responses[i] = responses[i] || noop;
	}
	log.ok('Init TCP operations and responses');
	return null;
})();

exports.dispatch = dispatch;
//exports.TCP_OPCODES = OP;