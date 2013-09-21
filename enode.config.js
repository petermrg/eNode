exports.config = {

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
		port: 5555,
		portObfuscated: 5565,
		maxConnections: 1000000,
		// time to wait before giving LowId (ms)
		connectionTimeout: 2000,
		allowLowIDs: true,
		minLowID: 1,
		maxLowID: 0xffffff,
	},

	udp: {
		// tcp+4
		port: 5559,
		portObfuscated: 5569,
		getSources: true,
		getFiles: true,
		serverKey: 0x12345678,
	},

	storage: {
		engine: 'mongodb',

		mysql: {
			database: 'enode',
			host: 'localhost',
			user: 'enode',
			pass: 'password',
			log: false,
			fullLog: false,
			connections: 8, // number of concurrent connections to MySQL server
			deadlockDelay: 100, // time to wait (ms) before retry deadlocked query
		},

		mongodb: {
			database: 'enode',
			host: 'localhost',
			port: '27017',
			log: true,
		}
	},

};

