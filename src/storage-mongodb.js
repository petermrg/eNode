require('./ed2k-globals.js');

var	config = require('../enode.config.js').storage,
	MongoClient = require('mongodb').MongoClient,
	log = require('tinylogger'),
	async = require('async'),
	util = require('util');

var noop = function() {};

/**
 * MongoDB Storage
 */
var	Storage = {
	db: null,
	collections: {},
};

Storage.clients = {


	/**
	 * Check if a client is connected
	 *
	 * @param  {Ed2kClient} client
	 * @param  {Function}   callback(err, isConnected)
	 */
	isConnected: function(client, callback) {
		Storage.collections.clients.findOne({ hash: client.hash, connected: true }, function (err, result) {
			if (!err) {
				console.log(result);
				log.info(['Storage.clients.isConnected:', err,	JSON.stringify(client),	JSON.stringify(result)].join(' '));
				callback(err, result != null);
			}
			else {
				log.error(['Storage.clients.isConnected:', err,	JSON.stringify(client),	JSON.stringify(result)].join(' '));
				callback(err, true);
			}
		})
	},

	/**
	 * Connect. Saves client information in database. Update client time
	 *
	 * @param {Ed2kClient} client
	 * @param {Function}   callback(err)
	 */
	connect: function(client, callback) {
		client.time = new Date();
		client.connected = true;

		Storage.collections.clients.save(
			{ 	// data
				hash: client.hash,
				id: client.id,
				port: client.port,
				connected: client.connected,
				time: client.time
			},
			{upsert: true},
			callback
		);
	},

	/**
	 * [disconnect description]
	 * @return {[type]} [description]
	 */
	disconnect: function(callback) {
		// remove sources if id is low id
	}

}

Storage.files = {

	/**
	 * Add source to database.
	 * If 'time' is not set, uses current date.
	 * If the source exists (equals 'hash', 'id' and 'port') then it's updated.
	 *
	 * @param {Ed2kClient} client
	 * @param {Ed2kFile}   file
	 * @param {Function}   callback(err, data) Optional. data = inserted data.
	 */
	addSource: function(client, file, callback) {
		//log.trace('Storage.files.addSource ' + file.hash.toString('hex'));
		var data = {},
			w = 1;

		if (!callback) {
			callback = noop;
			w = 0;
		}

 		data.hash = file.hash;
 		data.id = client.id|0;
		data.port = client.port|0;
		data.name = file.name;
		data.size = file.size|0;
		data.sizeHi = file.sizeHi|0;
		data.complete = !!file.complete;
		data.time = util.isDate(file.time) ? file.time : new Date();
		data._id = data.hash.toString('base64') + ':' + data.id.toString(36) + ':' + data.port.toString(36);
		log.trace(data._id);

		if (file.type) data.type = file.type;
		if (file.mediaArtist) data.mediaArtist = file.mediaArtist;
		if (file.mediaAlbum) data.mediaAlbum = file.mediaAlbum;
		if (file.mediaTitle) data.mediaTitle = file.mediaTitle;
		if (file.mediaLength) data.mediaLength = file.mediaLength|0;
		if (file.mediaBitrate) data.mediaBitrate = file.mediaBitrate|0;
		if (file.mediaCodec) data.mediaCodec = file.mediaCodec;

		Storage.collections.files.update(
			{_id: data._id},
			data, // data
			{upsert: true, w: w}, // options
			function(err, count) {
				callback(err, data);
			}
		);
	},

	/**
	 * getSources
	 *
	 * @param {Ed2kClient} client
	 * @param {Ed2kFile}   file
	 * @param {Function}   callback(err, array Ed2kFile)
	 */
	getSources: function(client, file, callback) {
		log.trace('Storage.files.getSources: ' + file.hash.toString('hex'));
		Storage.collections.files.find(
			{ 	// query
				hash: file.hash,
				size: file.size,
				sizeHi: file.sizeHi,
				id: { $ne: client.id },
				port: { $ne: client.port },
			},
			{_id: 0, id: 1, port: 1}, // fields
			{limit: config.returnSourcesLimit, sort: [['complete', -1], ['time', -1]]} // options
		).toArray(callback);
	},

	/**
	 * Counts files
	 *
	 * @param {Function} callback(err, count)
	 * @todo  add a TTL to the cache?
	 */
	count: function(callback) {
		Storage.collections.files.count(callback);
	},

	_count: null,

}

Storage.servers = {

}

/**
 * Connects to MongoDB server
 *
 * @param {Function} callback(err)
 */
var openConnection = function(callback) {
	var str = 'mongodb://' + config.mongodb.host + ':' + config.mongodb.port + '/' + config.mongodb.database;
	MongoClient.connect(str, {native_parser: true}, function(err, db) {
		if (!err) {
			Storage.db = db;
			Storage.bla = 1234;
			log.info('Connected to MongoDB: ' + str);
		} else {
			log.error('Failed to connect to MongoDB: ' + str);
		}
		callback(err);
	});
};

/**
 * Create MongoDB collections if they not exists
 *
 * @param {Function} callback(err)
 */
var createCollections = function(callback) {
	async.parallel([
		function (callback) {
			Storage.db.createCollection('clients', function(err, collection) {
				Storage.collections.clients = collection;
				callback(err, null);
			});
		},
		function (callback) {
			Storage.db.createCollection('files', function(err, collection) {
				Storage.collections.files = collection;
				callback(err, null);
			});
		},
		function (callback) {
			Storage.db.createCollection('servers', function(err, collection) {
				Storage.collections.servers = collection;
				callback(err, null);
			});
		},
	], function (err, results) {
		callback(err);
	});
};

/**
 * Set indexes
 *
 * @param  {Function} callback(err, values)
 */
var setIndexes = function(callback) {
	async.parallel([
		// File indexes
		function (callback) {
			Storage.collections.files.ensureIndex({hash: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({id: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({port: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({size: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({sizeHi: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({time: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({name: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({size: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({complete: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({type: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({mediaArtist: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({mediaAlbum: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({mediaTitle: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({mediaLength: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({mediaBitrate: 1}, callback);
		},
		function (callback) {
			Storage.collections.files.ensureIndex({mediaCodec: 1}, callback);
		},
		// Client indexes
		function (callback) {
			Storage.collections.clients.ensureIndex({hash: 1}, {unique: true}, callback);
		},
		function (callback) {
			Storage.collections.clients.ensureIndex({connected: 1}, callback);
		},
	], callback);
};

Storage.connect = function (callback) {
	log.info('Starting MongoDB storage...');
	async.series([
		openConnection,
		createCollections,
		setIndexes,
	], function (err, results) {
		if (!err) {
			log.ok('MongoDB ready!');
		} else {
			log.panic('Storage.init (MongoDB): Unexpected error');
			log.panic(err);
		}
		callback(err, results);
	});
};

Storage.disconnect = function (callback) {
	log.info('Disconnected from MongoDB');
	Storage.db.close(callback);
}

module.exports = Storage;

/*
exports.init = function(callback) {
	log.info('MongoDB init...')

	var db = new mongo.Db(
		conf.database,
		new mongo.Server(conf.host, conf.port, {}),
		dbOptions
	)

	db.open(function(err, db) {
		if (err) {
			log.panic('MongoDB init: Cannot connect to database. '+err)
			process.exit()
		}
		log.info('MongoDB init: database ''+conf.database+'' opened')

		// create collections
		var options = {
			fsync: true,
		}

		db.createCollection('clients', options, function(err, collection) {
			mongoErr(err)
			coll.clients = collection
			coll.clients.update({}, {'$set': {'online': 0}}, {'multi': 1}, mongoErr)
		})

		db.createCollection('files', options, function(err, collection) {
			mongoErr(err)
			coll.files = collection
			files.getCount(true, function(){})
			coll.files.ensureIndex({
				'name': 1,
				'hash': 1,
				'size': 1,
				'online': 1,
				'complete': 1,
				'time_offer': 1,
			}, mongoErr)
			coll.files.update({}, {'$set': {'online': 0}}, {'multi': 1}, mongoErr)
		})

		db.createCollection('servers', options, function(err, collection) {
			mongoErr(err)
			coll.servers = collection
			callback()
		})

		setInterval(function(){
			files.getCount(true, function(){})
		}, 5000*60)

	})

 */