const EventEmitter = require('events');
const WebSocket = require('ws');
const ConnectedClient = require('./connected-client');

const onConnection = methods => function (connection, req) {
    const client = new ConnectedClient(methods, connection);

    client.on('rpc.close', () => {
        this.clients.delete(client);
    });

    this.clients.add(client);

    this.emit('rpc.connection', client, req);
};

function onError (error) {
    this.emit('rpc.error', error);
}

function onListening () {
    this.emit('rpc.listening');
}

function heartbeat () {
    for (const client of this.clients) {
        if (client.isAlive) {
            client.isAlive = false;
            client.connection.ping();
        } else {
            client.connection.terminate();
        }
    }
}

class PassageServer extends EventEmitter {
    constructor (options = {}, callback) {
        super();

        this.clients = new Set();

        const methods = options.methods || {};
        delete options.methods;

        this.socket = new WebSocket.Server(options, callback);
        this.socket.on('connection', onConnection(methods).bind(this));
        this.socket.on('error', onError.bind(this));
        this.socket.on('listening', onListening.bind(this));

        const heartrate = options.heartrate || 30000;
        this._interval = setInterval(heartbeat.bind(this), heartrate);
    }

    close (callback) {
        clearInterval(this._interval);
        this.socket.close(callback);
    }
}

module.exports = PassageServer;
