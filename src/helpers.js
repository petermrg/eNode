
exports.Ip4toInt32LE = function(ip) {
	var ip = ip.split('.');
	return (ip.length == 4) ? (ip[0]|0) + ((ip[1]|0) * 0x100) + ((ip[2]|0) * 0x10000) + ((ip[3]|0) * 0x1000000) : 0;
}