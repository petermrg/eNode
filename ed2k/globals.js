// PROTOCOLS
global.PR_ED2K              = 0xe3;
global.PR_EMULE             = 0xc5;
global.PR_ZLIB              = 0xd4;

// OPCODES
global.OP_LOGINREQUEST      = 0x01;
global.OP_HELLO             = 0x01;
global.OP_HELLOANSWER       = 0x4c;
global.OP_SERVERMESSAGE     = 0x38;
global.OP_SERVERSTATUS      = 0x34;
global.OP_IDCHANGE          = 0x40;
global.OP_GETSERVERLIST     = 0x14;
global.OP_OFFERFILES        = 0x15;
global.OP_SERVERLIST        = 0x32;
global.OP_SERVERIDENT       = 0x41;
global.OP_GETSOURCES        = 0x19;
global.OP_FOUNDSOURCES      = 0x42;
global.OP_SEARCHREQUEST     = 0x16;
global.OP_SEARCHRESULT      = 0x33;
global.OP_CALLBACKREQUEST   = 0x1c;
global.OP_CALLBACKREQUESTED = 0x35;
global.OP_CALLBACKFAILED    = 0x36;
global.OP_GETSOURCES_OBFU   = 0x23;
global.OP_FOUNDSOURCES_OBFU = 0x44;

global.OP_GLOBSEARCHREQ3    = 0x90;
global.OP_GLOBSEARCHREQ2    = 0x92; //!! same as 3??
global.OP_GLOBGETSOURCES2   = 0x94;
global.OP_GLOBSERVSTATREQ   = 0x96;
global.OP_GLOBSERVSTATRES   = 0x97;
global.OP_GLOBSEARCHREQ     = 0x98;
global.OP_GLOBSEARCHRES     = 0x99;
global.OP_GLOBGETSOURCES    = 0x9a;
global.OP_GLOBFOUNDSOURCES  = 0x9b;
global.OP_SERVERDESCREQ     = 0xa2;
global.OP_SERVERDESCRES     = 0xa3;

global.TYPE_HASH            = 0x01;
global.TYPE_STRING          = 0x02;
global.TYPE_UINT32          = 0x03;
global.TYPE_FLOAT           = 0x04;
//global.TYPE_BOOL            = 0x05;
//global.TYPE_BOOLARR         = 0x06;
//global.TYPE_BLOB            = 0x07;
global.TYPE_UINT16          = 0x08;
global.TYPE_UINT8           = 0x09;
//global.TYPE_BSOB            = 0x0a;
global.TYPE_TAGS            = 0x0f;

global.TAG_NAME             = 0x01;
global.TAG_SIZE             = 0x02;
global.TAG_TYPE             = 0x03;
global.TAG_FORMAT           = 0x04;
global.TAG_VERSION          = 0x11;
global.TAG_VERSION2         = 0x91; // used in UDP OP_SERVERDESCRES
global.TAG_PORT             = 0x0f;
global.TAG_DESCRIPTION      = 0x0b;
global.TAG_DYNIP            = 0x85;
global.TAG_SOURCES          = 0x15;
global.TAG_COMPLETE_SOURCES = 0x30;
global.TAG_MULEVERSION      = 0xfb;
global.TAG_FLAGS            = 0x20;
global.TAG_RATING           = 0xF7;
global.TAG_SIZE_HI          = 0x3A;
global.TAG_SERVER_NAME      = 0x01;
global.TAG_SERVER_DESC      = 0x0b;
global.TAG_MEDIA_ARTIST     = 0xd0;
global.TAG_MEDIA_ALBUM      = 0xd1;
global.TAG_MEDIA_TITLE      = 0xd2;
global.TAG_MEDIA_LENGTH     = 0xd3;
global.TAG_MEDIA_BITRATE    = 0xd4;
global.TAG_MEDIA_CODEC      = 0xd5;
global.TAG_SEARCHTREE       = 0x0e;
global.TAG_EMULE_UDPPORTS   = 0xf9;
global.TAG_EMULE_OPTIONS1   = 0xfa;
global.TAG_EMULE_OPTIONS2   = 0xfe;
global.TAG_AUXPORTSLIST     = 0x93; // ???

// Constant values
global.VAL_PARTIAL_ID       = 0xfcfcfcfc;
global.VAL_PARTIAL_PORT     = 0xfcfc;
global.VAL_COMPLETE_ID      = 0xfbfbfbfb;
global.VAL_COMPLETE_PORT    = 0xfbfb;

// Flags
global.FLAG_ZLIB               = 0x0001;
global.FLAG_IPINLOGIN          = 0x0002;
global.FLAG_AUXPORT            = 0x0004;
global.FLAG_NEWTAGS            = 0x0008;
global.FLAG_UNICODE            = 0x0010;
global.FLAG_LARGEFILES         = 0x0100;
global.FLAG_SUPPORTCRYPT       = 0x0200;
global.FLAG_REQUESTCRYPT       = 0x0400;
global.FLAG_REQUIRECRYPT       = 0x0800;

global.FLAG_UDP_EXTGETSOURCES  = 0x0001;
global.FLAG_UDP_EXTGETFILES    = 0x0002;
global.FLAG_UDP_EXTGETSOURCES2 = 0x0020;
global.FLAG_UDP_OBFUSCATION    = 0x0200;
global.FLAG_TCP_OBFUSCATION    = 0x0400;

global.ENODE_VERSIONSTR        = 'v0.02a';
global.ENODE_VERSIONINT        = 0x00000002;
global.ENODE_NAME              = 'eNode';
