var crypto = require('crypto');

exports.ext = function(name) { return name.substring(name.lastIndexOf('.')+1, name.length).toLowerCase(); };

exports.hex = function(n, len) {
    n = (n*1).toString(16);
    while (n.length < len) n = '0' + n;
    return n;
};

exports.IPv4toInt32LE = function(IPv4) {
    var ip = IPv4.split('.');
    ip = (ip[0]*1) + (ip[1]*0x100) + (ip[2]*0x10000) + (ip[3]*0x1000000);
    if (ip<0) log.error(ip);
    return ip;
}


exports.md5 = function(buffer) {
    var md5 = crypto.createHash('md5');
    md5.update(buffer.toString('binary'));
    return new Buffer(md5.digest('binary'), 'binary');
}

var extensions = {
    video: '3gp,aaf,asf,avchd,avi,fla,flv,m1v,m2v,m4v,mp4,mpg,mpe,mpeg,mov,mkv,mp4,ogg,rm,svi'.split(','),
    audio: 'aiff,au,wav,flac,la,pac,m4a,ape,rka,shn,tta,wv,wma,brstm,amr,mp2,mp3,ogg,aac,m4a,mpc,ra,ots,vox,voc,mid,mod,s3m,xm,it,asf'.split(','),
    image: 'cr2,pdn,pgm,pict,bmp,png,dib,djvu,gif,psd,pdd,icns,ico,rle,tga,jpeg,jpg,tiff,tif,jp2,jps,mng,xbm,xcf,pcx'.split(','),
    pro  : '7z,ace,arc,arj,bzip2,cab,gzip,rar,tar,zip,iso,nrg,img,adf,dmg,cue,bin,cif,ccd,sub,raw'.split(','),
}

exports.getFileType = function(name) {
    if (!typeof name == 'string') { return '' };
    var ext = exports.ext(name);
    if (extensions.video.indexOf(ext)>=0) return 'Video';
    if (extensions.audio.indexOf(ext)>=0) return 'Audio';
    if (extensions.image.indexOf(ext)>=0) return 'Image';
    if (extensions.pro  .indexOf(ext)>=0) return 'Pro';
    return '';
};

/**
 * @description returns random value between 0 and n (both included)
 * @param {Integer} n
 * @returns {Integer} pseudo-random number (0..n)
 */
exports.rand = function(n) {
    return Math.round(Math.random() * n);
}

exports.randBuf = function(length) {
    return new Buffer(crypto.randomBytes(length), 'binary');
}

/**
 * @description Creates a RC4 key
 * @param {Buffer} buffer Keyphrase
 * @returns {Object} The key
 */
exports.RC4CreateKey = function(buffer) {
    var key = { state: [], x: 0, y: 0 };
    var len = buffer.length;
    var index1 = 0;
    var index2 = 0;
    var swap = 0;
    var i = 0;
    for (i=0; i<256; i++) { key.state[i] = i; }
    for (i=0; i<256; i++) {
        index2 = (buffer[index1] + key.state[i] + index2) % 256;
        swap = key.state[i];
        key.state[i] = key.state[index2];
        key.state[index2] = swap;
        index1 = ((index1 + 1) % len);
    }
    RC4Crypt(null, 1024, key); // drop first 1024 bytes
    return key;
};

/**
 * @description Encrypt/Decrypt using RC4 algorithm
 * @param {Buffer} buffer Data to encode or decode
 * @param {Integer} length Data size in bytes
 * @param {Object} key The RC4 key created with RC4CreateKey
 * @returns {Buffer} Output data buffer
 */
var RC4Crypt = exports.RC4Crypt = function(buffer, length, key){
    if (key == null) return;
    var swap = 0;
    var xorIndex = 0;
    if (buffer != null) { var output = new Buffer(length); }
    else { output = null; }
    for (var i=0; i<length; i++) {
        key.x = (key.x + 1) % 256;
        key.y = (key.state[key.x] + key.y) % 256;
        swap = key.state[key.x];
        key.state[key.x] = key.state[key.y];
        key.state[key.y] = swap;
        xorIndex = (key.state[key.x] + key.state[key.y]) % 256;
        if (buffer != null) { output[i] = (buffer[i] ^ key.state[xorIndex]) % 256; }
    }
    return output;
};
