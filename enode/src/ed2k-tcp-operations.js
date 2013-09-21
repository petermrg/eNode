var	Ed2kMessage = require('./ed2k-message.js').Ed2kMessage,
	log = require('tinylogger');

var OP = {
	LOGIN_REQUEST: 0x01,
	HELLO: 0x01,
	// HELLO_ANSWER: 0x4c,
	SERVER_MESSAGE: 0x38,
	SERVER_STATUS: 0x34,
	ID_CHANGE: 0x40,
	// GET_SERVER_LIST: 0x14,
	// OFFER_FILES: 0x15,
	// SERVER_LIST: 0x32,
	SERVER_IDENT: 0x41,
	// GET_SOURCES: 0x19,
	// FOUND_SOURCES: 0x42,
	// SEARCH_REQUEST: 0x16,
	// SEARCH_RESULT: 0x33,
	// CALLBACK_REQUEST: 0x1c,
	// CALLBACK_REQUESTED: 0x35,
	// CALLBACK_FAILED: 0x36,
	// GET_SOURCES_OBFU: 0x23,
	// FOUND_SOURCES_OBFU: 0x44
}

var operations = [];

/**
 * Dispatch message
 *
 * @param  {Ed2kMessage} message
 * @return {Buffer} response
 */
var dispatch = function(message) {
	var response = operations[message.readOpcode()](message);
	if (message.getSizeLeft() > 0) {
		log.error('loginRequest: remaining data in message');
	}
	return response;
};

/**
 * [description]
 * @param  {[type]} client  [description]
 * @param  {[type]} message [description]
 * @return {Buffer}
 */
operations[OP.LOGIN_REQUEST] = function (client, message) {
	log.info('Ed2kTcpOperations.loginRequest: ');
	var request = {
		hash: message.read(16),
		id: message.readUInt32LE(),
		port: message.readUInt16LE(),
		tags: message.readTags()
	}
	console.dir(request);
	return 0;
}

/**
 * Server Message
 *
 * @param {String} text Server message
 * @return {Buffer}
 */
operations[OP.SERVER_MESSAGE] = function (text) {
	return Ed2kMessage.serialize([
		[TYPE.UINT8, OP.SERVERMESSAGE],
		[TYPE.STRING, text],
	]);
}

/**
 * Server Status
 *
 * @return {Buffer}
 */
operations[OP.SERVER_STATUS] = function () {
	return Ed2kMessage.serialize([
		[TYPE_UINT8, OP_SERVERSTATUS],
		[TYPE_UINT32, db.clients.getCount()],
		[TYPE_UINT32, db.files.getCount()]
	]);
}

/**
 * ID Change
 *
 * @return {Buffer}
 */
operations[OP.ID_CHANGE] = function () {
	return Ed2kMessage.serialize([
		[TYPE_UINT8, OP_IDCHANGE],
		[TYPE_UINT32, id],
		[TYPE_UINT32, conf.tcp.flags]
	]);
}

/**
 * Server Ident
 *
 * @return {Buffer}
 */
operations[OP.SERVER_IDENT] = function () {
	return Ed2kMessage.serialize([
		[TYPE_UINT8, OP_SERVERIDENT],
		[TYPE_HASH, conf.hash],
		[TYPE_UINT32, misc.IPv4toInt32LE(conf.address)],
		[TYPE_UINT16, conf.tcp.port],
		[TYPE_TAGS, [
			[TYPE_STRING, TAG_SERVER_NAME, conf.name],
			[TYPE_STRING, TAG_SERVER_DESC, conf.description]
		]],
	]);
}

/**
 *
 * @return {Buffer}
 */
operations[OP.DUMMY] = function () {
	return Ed2kMessage.serialize([
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
 * Assign an array with a default function to unhandled operations
 */
;(function() {
	var noop = function (message) {
		log.warn('Unhandled opcode: 0x' + message.readOpcode().toString(16));
		response = false;
	}
	for (var i = 0; i < 256; i++) operations[i] = operations[i] || noop;
	log.ok('Init TCP operations');
	return null;
})();

exports.dispatch = dispatch;
//exports.TCP_OPCODES = OP;