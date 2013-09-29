var	Ed2kMessage = require('./ed2k-message.js');

var Ed2kFile = function() {
	this.hash = null; // 16 bytes buffer
	this.id = null; // int32 - the client id
	this.port = null; // int16 - the client port
	this.time = null;
	this.name = null;
	this.size = 0; // int32
	this.sizeHi = 0; // int32
	this.complete = null;
	this.type = null; // string
	this.mediaArtist = null;
	this.mediaAlbum = null;
	this.mediaTitle = null;
	this.mediaLength = null;
	this.mediaBitrate = null;
	this.mediaCodec = null;
}

/**
 * Reads file from message
 *
 * @param  {Ed2kClient} client
 * @param  {Ed2kMessage} message
 * @return {Ed2kFile}
 */
Ed2kFile.readFromMessage = function(client, message) {
	file = new Ed2kFile();
	file.hash = message.readHash(),
	file.complete = true,
	id = message.readUInt32LE();
	port = message.readUInt16LE();
	file.complete = (id == FILE.COMPLETE_ID && port == FILE.COMPLETE_PORT) ? true : false;
	file.port = client.port;
	file.id = client.id;
	message.readTags(function (tag) {
		file[tag[0]] = tag[1];
	});
	return file;
}

module.exports = Ed2kFile;