#eNode - A node.js eD2K/eMule Server

This is an *experimental-buggy-testing-pre-alpha* release. **Not ready to use!**

Contributions are welcome.

##Features:

* TCP/UDP opcodes
* TCP protocol obfuscation
* Lugdunum/emule extended protocol
* gzip compression
* LowID Callbacks
* Files > 4GiB
* Easy support for any storage engine.
  * look at `storage/storage.js` and create your own `engine.<name>.js` plugin

##Requires:

* Node.js v0.8+
* MySQL server
* Node.js modules:
  * [mysql](https://github.com/felixge/node-mysql)
  * [bigint](https://github.com/substack/node-bigint)
  * [hexy](https://github.com/a2800276/hexy.js): to do hexdumps, useful for debugging packets
  * [tinylogger](https://github.com/petermrg/tinylogger): to show messages in console
    * [colors](https://github.com/Marak/colors.js): used in tinylogger

##Usage:

### With MySQL database:

1. Create MySQL database tables. Database structure: `misc/enode.sql`
2. Modify config file: `enode.config.js`
3. Execute: `node enode.js` -or- `chmod +x enode.js` and then `./enode.js`
4. You can modify the verbose level modifing the options of the `tinylogger` module

If you want to test the server on a local network, change emule options to allow local connections.

##To do:

* gzip compression on send
* UDP protocol obfuscation
* IPv6 support: [unoficial draft for eD2K IPv6 extension](http://piratenpad.de/p/ed2kIPv6)
* Better storage and indexing. Perhaps with [Sphinx](http://sphinxsearch.com/)
* Support for [Nat Traversal](http://en.wikipedia.org/wiki/NAT_traversal)

##Thanks to:

* David Xanatos
