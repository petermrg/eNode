
var lowIdClients = {

    _min: 1,
    _max: 0xffffff,
    _count: 0,
    _next: 1,
    _clients: {},

    _nextId: function() {
        if (!conf.tcp.allowLowIDs) return false;
        if (lowIdClients._count >= lowIdClients._max - lowIdClients._min + 1) return false;
        var r = lowIdClients._next;
        lowIdClients._next++;
        while (lowIdClients._clients.hasOwnProperty[lowIdClients._next]) {
            lowIdClients._next++;
            if (lowIdClients._next > lowIdClients._max) { lowIdClients._next = lowIdClients._min; };
        }
        return r;
    },

    count: function() {
        return lowIdClients._count;
    },

    add: function(client) {
        var id = lowIdClients._nextId();
        if (id != false) { lowIdClients._clients[id] = client; }
        return id;
    },

    get: function(id) {
        if (lowIdClients._clients.hasOwnProperty(id)) {
            return lowIdClients.clients[id];
        }
        else {
            return false;
        }
    },

    remove: function(id) {
        lowIdClients._count--;
        delete lowIdClients._clients[id];
    }

};

exports.lowIdClients = lowIdClients;
