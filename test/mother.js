require('../src/ed2k-globals.js');

var Ed2kFile = require('../src/ed2k-file.js'),
	Ed2kClient = require('../src/ed2k-client.js'),
	crypt = require('../src/crypt.js');

var Mother = {

	makeHash: function() {
		return crypt.md5(Math.random().toString());
	},

	makePort: function() {
		return Math.round(Math.random() * 0xffff);
	},

	makeIPv4: function() {
		return Math.round(Math.random() * 0xffffffff);
	},

	makeId: function() {
		return Math.round(Math.random() * 0xffffffff);
	},

	makeDate: function() {
		return new Date((new Date()).getTime() - Math.round(Math.random() * 0xffffffffff));
	},

	makeString: function(min, max) {
		var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_ '.split('');
		var count =  min + Math.round(Math.random() * (max - min));
		var str = '';
		while (count--) {
			str+= chars[Math.floor(Math.random() * chars.length)];
		}
		return str;
	},

	makeEd2kFile: function () {
		var file = new Ed2kFile();
		file.hash = Mother.makeHash();
		file.id = Mother.makeIPv4();
		file.port = Mother.makePort();
		file.timestamp = Mother.makeDate();
		file.name = Mother.makeString(5, 40);
		file.size = Math.round(Math.random() * 0xffffffff);
		file.sizeHi = Math.round(Math.random() * 0xf);
		file.complete = (Math.random() >= .5);
		file.type = null;
		file.mediaArtist = null;
		file.mediaAlbum = null;
		file.mediaTitle = null;
		file.mediaLength = null;
		file.mediaBitrate = null;
		file.mediaCodec = Mother.makeString(2,5);
		return file;
	},

	makeEd2kClient: function () {
		var client = new Ed2kClient();
		client.id = Mother.makeId();
		client.hash = Mother.makeHash();
		client.status = CS.NOT_LOGGED;
		client.address = Mother.makeIPv4();
		client.port = Mother.makePort();;
		client.name = Mother.makeString(3, 32);
		client.version = 0;
		client.muleVersion = 0;
		client.flags = 0;
		client.time = new Date();
		return client;
	}
}

module.exports = Mother;