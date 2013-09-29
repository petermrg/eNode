module.exports = {

	name: 'eNode Server (TESTING)',
	description: 'eNode: experimental ed2k server written in node.js',
	address: '192.168.1.2',
	dynIp: '',

	versionString: 'v0.04',
	versionInt: 0x00000003,

	messageLowID: 'You have LowID.',
	messageLogin: 'Welcome to eNode!',

	// Set noAssert to true to skip offset validation in Buffers
	noAssert: false,

	supportCrypt: true,
	requestCrypt: true,
	requireCrypt: true,
	auxiliarPort: false, // ??
	IpInLogin: false, // ??

	tcp: {
		port: 50001,
		portObfuscated: 60000,
		maxConnections: 1000000,
		// time to wait before giving LowId (ms)
		connectionTimeout: 2000,
		allowLowIDs: true,
		minLowID: 1,
		maxLowID: 0xffffff,
	},

	udp: {
		// tcp+4
		port: 50004,
		portObfuscated: 60004,
		getSources: true,
		getFiles: true,
		serverKey: 0x12345678,
	},

	storage: {
		engine: 'mongodb',
		returnSourcesLimit: 256, // max 256

		mongodb: {
			database: 'enode',
			host: 'localhost',
			port: 27017,
			log: true,
		}
	},

};

