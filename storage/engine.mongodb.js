var mongo = require('mongodb'),
  log = require('tinylogger'),
  misc = require('../ed2k/misc.js'),
  conf = require('../enode.config.js').config.storage.mongodb;

var client = new mongo.Db(
  'test',
  new mongo.Server(conf.host, conf.port, {}), {w: 1}
);

var test = function (err, collection) {
  collection.insert({a:2}, function(err, docs) {

    collection.count(function(err, count) {
      test.assertEquals(1, count);
    });

    // Locate all the entries using find
    collection.find().toArray(function(err, results) {
      test.assertEquals(1, results.length);
      test.assertTrue(results[0].a === 2);

      // Let's close the db
      client.close();
    });
  });
};

client.open(function(err, p_client) {
  client.collection('test_insert', test);
});

exports.clients = {
  count: function() {},
  isConnected: function(clientInfo, callback) {},
  connect: function(clientInfo, callback) {},
  disconnect: function(clientInfo) {},
};

exports.files = {
  count: function() {},
  add: function(file, clientInfo) {},
  getSources: function(fileHash, fileSize, clientInfo, callback) {},
  getSourcesByHash: function(fileHash, callback) {},
  find: function(data, callback) {},
};

exports.servers = {
  count: function() {},
  add: function() {},
  all: function() {},
};
