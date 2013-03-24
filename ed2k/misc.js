var hexDump = require('hexy').hexy

exports.hexDump = function(data) {
  console.log(hexDump(data))
}

exports.ext = function(name) {
  return name.substring(name.lastIndexOf('.')+1, name.length).toLowerCase()
}

exports.hex = function(n, len) {
  n = (n*1).toString(16)
  while (n.length < len) n = '0' + n
  return n
}

exports.IPv4toInt32LE = function(IPv4) {
  var ip = IPv4.split('.')
  ip = (ip[0]*1) + (ip[1]*0x100) + (ip[2]*0x10000) + (ip[3]*0x1000000)
  if (ip<0) log.error(ip)
  return ip
}

/**
 * Get file type based on file extension. The file type can be one on these:
 * 'video', 'audio', 'image', 'pro'.
 *
 * @param {String} name Filename
 * @returns {String} File type
 */
exports.getFileType = function(name) {
  var extensions = {
    video:
      '3gp,aaf,asf,avchd,avi,fla,flv,m1v,m2v,m4v,mp4,mpg,mpe,mpeg,mov,mkv,mp4,'+
      'ogg,rm,svi'
      .split(','),
    audio:
      'aiff,au,wav,flac,la,pac,m4a,ape,rka,shn,tta,wv,wma,brstm,amr,mp2,mp3,'+
      'ogg,aac,m4a,mpc,ra,ots,vox,voc,mid,mod,s3m,xm,it,asf'
      .split(','),
    image:
      'cr2,pdn,pgm,pict,bmp,png,dib,djvu,gif,psd,pdd,icns,ico,rle,tga,jpeg,'+
      'jpg,tiff,tif,jp2,jps,mng,xbm,xcf,pcx'
      .split(','),
    pro:
      '7z,ace,arc,arj,bzip2,cab,gzip,rar,tar,zip,iso,nrg,img,adf,dmg,cue,bin,'+
      'cif,ccd,sub,raw'.split(','),
  }
  if (!typeof name == 'string') { return '' }
  var ext = exports.ext(name)
  if (extensions.video.indexOf(ext)>=0) return 'Video'
  if (extensions.audio.indexOf(ext)>=0) return 'Audio'
  if (extensions.image.indexOf(ext)>=0) return 'Image'
  if (extensions.pro  .indexOf(ext)>=0) return 'Pro'
  return ''
}

exports.isProtocol = function(protocol) {
  return
    (protocol == PR_ED2K) ||
    (protocol == PR_EMULE) ||
    (protocol == PR_ZLIB)
}

/**
 * Draws an ASCII box around some text
 */
exports.box = function(text) {
  var l = text.length + 2
  var s = ''
  while (l--) s+= '-'
  s = '+'+s+'+'
  return s+'\n'+'| '+text+' |'+'\n'+s
}

/**
 * Returns a UNIX timestamp
 */
exports.unixTimestamp = function() {
  return Math.round((new Date()).getTime()/1000)
}
