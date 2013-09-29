/**
 * Protocol codes
 */
global.PR = {
	ED2K: 				0xe3,
	EMULE: 				0xc5,
	ZLIB: 				0xd4,
}

/**
 * Types
 */
global.TYPE = {
	HASH: 				0x01,
	STRING: 			0x02,
	UINT32: 			0x03,
	FLOAT: 				0x04,
	//BOOL: 			0x05,
	//BOOLARR: 			0x06,
	//BLOB: 			0x07,
	UINT16: 			0x08,
	UINT8: 				0x09,
	//BSOB: 			0x0a,
	TAGS: 				0x0f,
}

/**
 * Message Tag codes
 */
global.TAG = {
	name: 				0x01,
	size: 				0x02,
	type: 				0x03,
	format: 			0x04,
	version: 			0x11,
	flags: 				0x20,
	sizeHi: 			0x3a,
	description: 		0x0b,
	searchTree: 		0x0e,
	port: 				0x0f,
	sources: 			0x15,
	completeSources: 	0x30,
	dynIp: 				0x85,
	version2: 			0x91, // used in UDP OP_SERVERDESCRES
	auxportslist: 		0x93,
	mediaArtist: 		0xd0,
	mediaAlbum: 		0xd1,
	mediaTitle: 		0xd2,
	mediaLength: 		0xd3,
	mediaBitrate: 		0xd4,
	mediaCodec: 		0xd5,
	muleVersion: 		0xfb,
	rating: 			0xf7,
	emuleUdpPorts: 		0xf9,
	emuleOptions1: 		0xfa,
	emuleOptions2: 		0xfe,
};

global.TAG_INVERSE = {};

;(function() {
	for (var name in TAG) {
		TAG_INVERSE[TAG[name]] = name;
	}
})();

/**
 * File constants
 */
global.FILE = {
	PARTIAL_ID: 		0xfcfcfcfc,
	COMPLETE_ID: 		0xfbfbfbfb,
	PARTIAL_PORT: 		0xfcfc,
	COMPLETE_PORT: 		0xfbfb,
}

/**
 * Flags
 */
global.FLAG = {
	ZLIB: 				0x0001,
	IP_IN_LOGIN:		0x0002,
	AUX_PORT: 			0x0004,
	NEW_TAGS: 			0x0008,
	UNICODE: 			0x0010,
	LARGE_FILES: 		0x0100,
	SUPPORT_CRYPT: 		0x0200,
	REQUEST_CRYPT: 		0x0400,
	REQUIRE_CRYPT: 		0x0800,
}

/**
 * Opcodes
 */
global.OP = {
	LOGIN_REQUEST: 		0x01, // aka HELLO
	// HELLO_ANSWER: 		0x4c,
	REJECT:				0x05,
	GET_SERVER_LIST: 	0x14,
	OFFER_FILES: 		0x15,
	// SEARCH_REQUEST: 	0x16,
	GET_SOURCES: 		0x19,
	// CALLBACK_REQUEST: 	0x1c,
	GET_SOURCES_OBFU: 	0x23,
	// SERVER_LIST: 		0x32,
	// SEARCH_RESULT: 		0x33,
	SERVER_STATUS: 		0x34,
	// CALLBACK_REQUESTED: 0x35,
	// CALLBACK_FAILED: 	0x36,
	SERVER_MESSAGE: 	0x38,
	ID_CHANGE: 			0x40,
	SERVER_IDENT: 		0x41,
	FOUND_SOURCES: 		0x42,
	FOUND_SOURCES_OBFU: 0x44
}

/**
 * Client Status
 */
global.CS = {
	NOT_CONNECTED:		0x00,
	CONNECTED: 			0x01,
	CONNECTION_CLOSE: 	0xF0,
}