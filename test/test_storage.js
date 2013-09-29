var config = require('../enode.config.js').storage,
	Ed2kFile = require('../src/ed2k-file.js'),
	Ed2kClient = require('../src/ed2k-client.js'),
	crypt = require('../src/crypt.js'),
	assert = require('assert'),
	util = require('util'),
	async = require('async'),
	log = require('tinylogger').disable(),
	Mother = require('./mother.js');

// first change the config for testing
config.engine = 'mongodb';
config.mongodb.database = 'enode_testing';
config.returnSourcesLimit = 256;

var Storage = require('../src/storage-mongodb.js');

describe('Storage.files', function() {

	beforeEach(function(done) {
		Storage.connect(function(err) {
			assert.equal(err, null);
			Storage.collections.files.remove({}, {w: 1, safe: true}, function(err) {
				assert.equal(err, null);
				done(err);
			});
		});
	});

	afterEach(function(done) {
		Storage.disconnect(done);
	});

	var file1 = Mother.makeEd2kFile(),
		file2 = Mother.makeEd2kFile(),
		file3 = Mother.makeEd2kFile(),
		client1 = Mother.makeEd2kClient();

	describe('#addSource()', function() {
		it('adds new sources in parallel', function(done) {
			async.parallel([
				function(callback) {
					Storage.files.addSource(client1, file1, callback);
				},
				function(callback) {
					Storage.files.addSource(client1, file2, callback);
				},
				function(callback) {
					Storage.files.addSource(client1, file3, callback);
				},
			], function(err, inserts) {
				var hashes = [file1.hash, file2.hash, file3.hash];
				inserts.forEach(function(data) {
					var i = hashes.indexOf(data.hash);
					assert.equal(i >= 0, true);
					hashes.splice(i, 1);
				});
				Storage.files.count(function(err, count) {
					assert.equal(count, 3);
					done(err);
				});
			});
		});

		it('updates a source if exists and sets time automatically if none given', function(done) {
			var date1 = new Date('2000-01-01'),
				date2 = new Date();
			async.series([
				function(callback) {
					file1.time = date1;
					file1.name = '1234';
					Storage.files.addSource(client1, file1, callback);
				},
				function(callback) {
					file1.time = null;
					file1.name = 'abcd';
					date = new Date();
					Storage.files.addSource(client1, file1, callback);
				},
				// @todo get sources and check that it's updated to the last one
			], function(err, results) {
				assert.equal(results[0].name, '1234');
				assert.equal(results[1].name, 'abcd');
				assert.equal(results[0].time.getTime(), date1.getTime());
				assert.equal(results[1].time >= date2, true);
				Storage.files.count(function(err, count) {
					assert.equal(count, 1);
					done(err);
				});
			});
		});
	});

	describe('#getSources()', function() {

		var count = config.returnSourcesLimit,
			docs = [];

		file1.size = 12345;
		client1.id = 1000;
		client1.port = 1000;

		for (var i = 0; i < count; i++) {
			var doc1 = Mother.makeEd2kFile();
			var doc2 = Mother.makeEd2kFile();

			doc1.hash = file1.hash;
			doc1.id = client1.id + i;
			doc1.port = client1.port + i;
			doc1.size = file1.size;
			doc1.sizeHi = file1.sizeHi;
			docs.push(doc1);

			doc2.hash = file1.hash;
			doc2.id = client1.id + i;
			doc2.port = client1.port + i;
			doc2.size = file1.size + 1 + i
			docs.push(doc2);
		}

		it('inserts ' + count*2 + ' files and then asks for sources', function(done) {
			Storage.collections.files.insert(docs, {w: 1}, function (err, insertedFiles) {
				// restore client and size values
				assert.equal(err, null);
				assert.equal(insertedFiles.length, count * 2);
				Storage.files.getSources(client1, file1, function (err, files) {
					assert.equal(err, null);
					assert.equal(files.length, count - 1);
					files.forEach(function (file) {
						assert.notEqual(file.id, client1.id);
						assert.notEqual(file.port, client1.port);
					});
					done();
				});
			});
		});

	});
});

