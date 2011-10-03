var net  = require('net'),
    exec = require('child_process').exec,
    temp = require('temp'),
    uuid = require('uuid'),
    util = require('util'),
    fs   = require('fs');

var app_sockets = {};
var uuids       = {};
var streams     = [];
var termcast_sessions = {};

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
    var u;
    socket.on('data', function(data) {
        if (!termcast_sessions[u]) {
            var words = data.toString('utf8').split(' ', 3);
            socket.write('hello, ' + words[1] + "\n");
            termcast_sessions[u].session_id = u;
            termcast_sessions[u].user = words[1];
        }
        else {
            for (var fd in app_sockets[u]) {
                app_sockets[u][fd].write(data);
            }
        }
    });

    temp.open('termcast', function(e, info) {
        if (e) throw e;

        u = uuid.generate();
        app_sockets[u] = {};
        termcast_sessions[u] = {
            socket: info.path,
        };

        // termcast socket closing means no more unix sockets
        socket.on('close', function(had_error) {
            socket.destroy();
             for (var fd in app_sockets[u]) {
                 app_sockets[u][fd].destroy();
             }
             delete app_sockets[u];
        });

        console.log(info.path);

        // Close the info so we can bind a socket to it instead
        fs.closeSync(info.fd);
        fs.unlinkSync(info.path);

        var stream = net.createServer(function (usocket) {
            app_sockets[u][usocket.fd] = usocket;
            usocket.on('close', function(had_error) {
                if (app_sockets[u]) delete app_sockets[u][usocket.fd];
            });
        });
        stream.listen(info.path);
    });
});

manager.listen('connections.sock');
termcast.listen(31337);
