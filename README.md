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

##Usage:

    1. Create mysql database tables (import shema in `misc/enode.sql`).
    2. Modify config file: `enode.config.js`.
    3. Execute: `node enode.js` -or- `chmod +x enode.js` and then `./node.js`.
    4. You can modify the verbose level modifing the options of the `tinylogger` module.

##Thanks to:

    * David_X
