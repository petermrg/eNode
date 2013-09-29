
exports.Ip4toInt32LE = function(ip) {
	var ip = ip.split('.');
	return (ip.length == 4) ? (ip[0]|0) + ((ip[1]|0) * 0x100) + ((ip[2]|0) * 0x10000) + ((ip[3]|0) * 0x1000000) : 0;
};

exports.Int32LEtoIp4 = function(ip) {
	ip = ip|0;
	return [ip & 0xff, (ip >> 8) & 0xff, (ip >> 16) & 0xff, (ip >> 24) & 0xf].join('.');
};