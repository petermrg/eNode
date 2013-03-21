#eNode - A node.js eD2K/eMule Server

This is an *experimental-buggy-testing-pre-alpha* release. **Not ready to use!**

Contributions are welcome.

##Features:

* TCP/UDP opcodes
* TCP/UDP protocol obfuscation
* Obfuscated lowID detection
* Lugdunum/emule extended protocol
* gzip compression
* LowID Callbacks
* Files > 4GiB
* Easy support for any storage engine.
  * look at `storage/storage.js` and create your own `engine.<name>.js` plugin

##Requires:

* Node.js v0.10.x
* MySQL server || MongoDB

##Dependencies:

* [hexy](https://github.com/a2800276/hexy.js): hexdumps, useful for debugging packets
* [tinylogger](https://github.com/petermrg/tinylogger): to show messages in console
  * [colors](https://github.com/Marak/colors.js): required by tinylogger
* [mysql](https://github.com/felixge/node-mysql)
* [mongodb](https://github.com/mongodb/node-mongodb-native)

##Usage:

### With MySQL database:

1. Create MySQL database tables. Database structure: `misc/enode.sql`
2. Modify config file: `enode.config.js`
3. Execute: `node enode.js` -or- `chmod +x enode.js` and then `./enode.js`
4. You can modify the verbose level modifing the options of the `tinylogger` module

If you want to test the server on a local network, change emule options to allow local connections.

##To do:

* gzip compression on send
* Send OP_SERVERSTATUS every 5 minutes to connected clients
* Better storage/indexing
* IPv6 support: [unoficial draft for eD2K IPv6 extension](http://piratenpad.de/p/ed2kIPv6)
* Support for [Nat Traversal](http://en.wikipedia.org/wiki/NAT_traversal)

##Thanks to:

* David Xanatos
