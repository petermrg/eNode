var conf = require('../enode.config.js').config
var engine = require('./engine.'+conf.storage.engine+'.js')

exports.init = engine.init
exports.clients = engine.clients
exports.files = engine.files
exports.servers = engine.servers
