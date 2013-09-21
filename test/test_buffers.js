var assert = require("assert"),
	DynamicBuffer = require('../src/dynamic-buffer.js').DynamicBuffer;

describe('DynamicBuffer', function() {

	beforeEach(function() {

	});

	describe('#sizeLeft()', function() {
		it('gets available free space in buffer', function() {
			var d = new DynamicBuffer(50);
			d.seek(40);
			assert.equal(d.getSize(), 50);
			assert.equal(d.tell(), 40);
			assert.equal(d.getSizeLeft(), 10);
		})
	});

	describe('#grow()', function() {
		it('doubles buffer size without affecting content and position', function() {
			var str = '1234567890',
				len = str.length,
				d = new DynamicBuffer();
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
		it('writes a buffer', function() {
			var str1 = '1234567890',
				str2 = 'ABCDEFG',
				b1 = new Buffer(str1),
				b2 = new Buffer(str2),
				d = new DynamicBuffer(5);
			d.writeBuffer(b1);
			assert.equal(d.toString(), str1);
			d.writeBuffer(b2);
			assert.equal(d.toString(), str1 + str2);
		});
	});

});

