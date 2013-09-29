var crypto = require('crypto');

exports.md5 = function(data) {
  var md5 = crypto.createHash('md5');
  md5.update(data);
  return md5.digest();
}