var assert = require("assert"),
	Ed2kTcpStream = require('../src/ed2k-tcp-stream.js').Ed2kTcpStream;
	CS = require('../src/ed2k-tcp-stream.js').CLIENT_STATUS;

describe('Ed2kTcpStream', function() {

	beforeEach(function() {

	});

	describe('#parse()', function() {
		var goodPacket1  = new Buffer([0xe3, 0x04, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04]),
			goodPacket2  = new Buffer([0xe3, 0x08, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
			// partPacket2a + partPacked2b = goodPacket2
			partPacket2a = new Buffer([0xe3, 0x08, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03]),
			partPacket2b = new Buffer([0x04, 0x05, 0x06, 0x07, 0x08]),
			badPacket1 	 = new Buffer([0xFF, 0x08, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
			r = null;

		it('writes data to stream', function() {
			var stream = new Ed2kTcpStream();
			stream.append(CS.NEW, goodPacket1);
			assert.equal(stream.toString(), goodPacket1.toString());
			stream.append(CS.NEW, goodPacket2);
			assert.equal(stream.toString(), goodPacket1.toString() + goodPacket2.toString());
		});

		it('reads a single valid message', function() {
			var stream = new Ed2kTcpStream();
			stream.append(CS.NEW, goodPacket1);
			r = stream.parse();
			assert.equal(r.length, 1);
			assert.equal(stream.tell(), 0);
			r.forEach(function(p) {	assert.equal(p.tell(), p.getSize()); });
			assert.equal(r[0].toString('hex'), goodPacket1.toString('hex'));
		});

		it('reads multiple valid messages', function() {
			var stream = new Ed2kTcpStream();
			stream.append(CS.NEW, goodPacket1);
			stream.append(CS.NEW, goodPacket2);
			stream.append(CS.NEW, goodPacket1);
			r = stream.parse();
			assert.equal(r.length, 3);
			assert.equal(stream.tell(), 0);
			r.forEach(function(p) {	assert.equal(p.tell(), p.getSize()); });
			assert.equal(r[0].toString('hex'), goodPacket1.toString('hex'));
			assert.equal(r[1].toString('hex'), goodPacket2.toString('hex'));
			assert.equal(r[2].toString('hex'), goodPacket1.toString('hex'));
		});

		it('waits until message is completed', function() {
			var stream = new Ed2kTcpStream();
			stream.append(CS.NEW, partPacket2a);
			var tmp = stream.tell();
			r = stream.parse();
			assert.equal(r.length, 0);
			assert.equal(stream.tell(), tmp);
			stream.append(CS.NEW, partPacket2b);
			stream.append(CS.NEW, goodPacket1);
			stream.append(CS.NEW, goodPacket2);
			r = stream.parse();
			assert.equal(r.length, 3);
			assert.equal(stream.tell(), 0);
			r.forEach(function(p) {	assert.equal(p.tell(), p.getSize()); });
			assert.equal(r[0].toString('hex'), goodPacket2.toString('hex'));
			assert.equal(r[1].toString('hex'), goodPacket1.toString('hex'));
			assert.equal(r[2].toString('hex'), goodPacket2.toString('hex'));
		});

		it('ignores a bad message and discards stream', function() {
			var stream = new Ed2kTcpStream();
			stream.append(CS.NEW, badPacket1);
			r = stream.parse();
			assert.equal(r.length, 0);
			assert.equal(stream.tell(), 0);
		});

	});

});

