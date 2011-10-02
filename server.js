var net  = require('net'),
    exec = require('child_process').exec,
    temp = require('temp'),
    uuid = require('uuid'),
    util = require('util'),
    fs   = require('fs');

var app_sockets = {};
var uuids       = {};
var streams     = [];

var manager = net.createServer(function (socket) {
    socket.on('data', function(data) {
        var data = JSON.parse(data);
        if (data['request']) {
            if (data['request'] == 'sessions') {
                var sessions = [];
                // TODO actually send session list, etc
                socket.write(
                    JSON.stringify(
                        {
                            response: 'sessions',
                            sessions: [],
                        }
                    )
                );
            }
        }
    });
});

var termcast = net.createServer(function (socket) {
    temp.open('termcast', function(e, info) {
        if (e) throw e;

        var u = uuid.generate();
        app_sockets[u] = {};

        // termcast socket closing means no more unix sockets
        socket.on('close', function(had_error) {
            for (var fd in app_sockets[u]) {
                app_sockets[u][fd].close();
            }
            delete app_sockets[u];
        });

        console.log(info.path);

        // Close the info so we can bind a socket to it instead
        fs.closeSync(info.fd);
        fs.unlinkSync(info.path);

        var stream = net.createServer(function (usocket) {
            app_sockets[u][usocket.fd] = usocket;
            util.pump(socket, usocket);
            usocket.on('close', function(had_error) {
                delete app_sockets[u][usocket.fd];
            });
        });
        stream.listen(info.path);
        streams.push(stream);
    });
});

manager.listen('connections.sock');
termcast.listen(31337);
