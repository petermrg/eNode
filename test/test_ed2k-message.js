var assert = require("assert"),
	Ed2kPacket = require('../src/ed2k-message.js').Ed2kMessage;

describe('Ed2kMessage', function() {

	beforeEach(function() {

	});

	describe('#sizeLeft()', function() {
		it('gets available free space in message', function() {
			var d = new Ed2kPacket(50);
			assert.equal(d.getSizeLeft(), 50);
			d.seek(40);
			assert.equal(d.getSize(), 50);
			assert.equal(d.tell(), 40);
			assert.equal(d.getSizeLeft(), 10);
		})
	});

	describe('#grow()', function() {
		it('increases message size without affecting content and position', function() {
			var str = '1234567890',
				len = str.length,
				d = new Ed2kPacket();
			d._buffer = new Buffer(str);
			d._position = len;
			d.grow(2);
			assert.equal(d._buffer.length, len * 2);
			assert.equal(d.toString(), str);
			assert.equal(d.getSize(), len * 2);
			assert.equal(d.tell(), len);
		})
	});

	describe('#writeBuffer()', function() {
		it('appends data to message buffer', function() {
			var str1 = '1234567890',
				str2 = 'ABCDEFG',
				b1 = new Buffer(str1),
				b2 = new Buffer(str2),
				d = new Ed2kPacket(5);
			d.writeBuffer(b1);
			assert.equal(d.toString(), str1);
			d.writeBuffer(b2);
			assert.equal(d.toString(), str1 + str2);
		});
	});

	describe('#shift()', function() {
		var str1 = '1234567890-1234567890',
			str2 = 'ABCDEF',
			b1 = new Buffer(str1 + str2),
			b2 = new Buffer(str2 + str1),
			d = new Ed2kPacket(1),
			r = null;
		it('shifts a block of data from the message and returns it', function() {
			d.writeBuffer(b1);
			r = d.shift(str1.length);
			assert.equal(r.tell(), str1.length);
			assert.equal(d.tell(), str2.length);
			assert.equal(r.toString(), str1);
			assert.equal(d.toString(), str2);
		});
		it('shifts another block of data from the message', function() {
			d.seek(0);
			d.writeBuffer(b2);
			r = d.shift(str2.length);
			assert.equal(r.tell(), str2.length);
			assert.equal(d.tell(), str1.length);
			assert.equal(r.toString(), str2);
			assert.equal(d.toString(), str1);
		});
	});

});

