exports.config = {

    name: '(TESTING!!!) eNode',
    description: 'eNode: experimental ed2k server written in node.js',
    address: '192.168.1.2',
    //address: '192.168.1.50',
    //address: '192.168.1.33',
    //address: '192.168.43.61',
    dynIp: '',

    messageLowID: 'You have LowID.',
    messageLogin: 'Welcome to eNode!',

    noAssert: false, // Set noAssert to true to skip offset validation in Buffers

    supportCrypt: true,
    requestCrypt: true,
    requireCrypt: true,
    auxiliarPort: false, // ??
    IPinLogin: false, // ??

    tcp: {
        port: 5555,
        portObfuscated: 5565,
        maxConnections: 1000000,
        connectionTimeout: 2000, // time to wait before giving LowId (ms)
        allowLowIDs: true,
        minLowID: 1,
        maxLowID: 0xffffff,
    },

    udp: {
        port: 5559, // tcp+4
        portObfuscated: 5569,
        getSources: true,
        getFiles: true,
        serverKey: 0x12345678,
    },

    storage: {
        engine: 'mysql',
        mysql: {
            database: 'enode',
            host: 'localhost',
            user: 'enode',
            pass: 'password',
            log: false,
            fullLog: false,
            connections: 32, // number of concurrent connections to MySQL server
            deadlockDelay: 100, // time to wait (ms) before retry deadlocked query
        },
    },

};

