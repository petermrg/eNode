exports.config = {

    name: '(TESTING!!!) eNode',
    description: 'eNode: experimental ed2k server written in node.js',
    address: '192.168.1.2',
    dynIp: '',

    messageLowID: 'You have LowID.',
    messageLogin: 'Welcome to eNode!',

    supportCrypt: false, // not implemented
    requestCrypt: false, // not implemented
    requireCrypt: false, // not implemented
    auxiliarPort: false, // ??
    IPinLogin: false, // ??

    tcp: {
        port: 5555,
        maxConnections: 1000000,
        connectionTimeout: 2000, // time to wait before giving LowId (ms)
        allowLowIDs: true,
        minLowID: 1,
        maxLowID: 0xffffff,
    },

    udp: {
        port: 5559, // tcp+4
        getSources: true,
        getFiles: true,
    },

    mysql: {
        database: 'enode',
        host: 'localhost',
        user: 'enode',
        pass: 'password',
        log: true,
        fullLog: false,
        connections: 32, // number of concurrent connections to MySQL server
        deadlockDelay: 100, // time to wait (ms) before retry a deadlocked query
    },

};
