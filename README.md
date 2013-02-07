#eNode - A node.js Emule/Ed2k Server

This is a *experimental-buggy-testing-pre-alpha* release. **Not ready to use!**

Contributions are welcome.

##Features:

* TCP/UDP opcodes
* Lugdunum/emule extended protocol
* gzip compression
* LowID Callbacks
* Files > 4GiB
* Easy support for any storage engine.
  * look at `ed2k/storage.js` and create your own `storage.<engine>.js` plugin

##Requires:

* Node.js v0.8+
* MySQL server
* Node.js modules:
  * mysql
  * hexy: to do hexdumps, useful for debugging packets
  * tinylogger: to show messages in console
    * colors: used in tinylogger

##Usage:

1. Create MySql database tables. Import shema in `misc/enode.sql`
2. Modify config file: `enode.config.js`
3. Execute: `node enode.js` -or- `chmod +x enode.js` and then `./node.js`
4. You can modify the verbose level modifing the options of the `tinylogger` module
 
If you want to test the server on a local network, change emule options to allow local connections.

##Thanks to:

* David_X
