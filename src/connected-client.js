const EventEmitter = require('events');
const buildResponse = require('./util/build-response');
const jsonrpc = require('./version');

const onMessage = methods => function (data) {
    this.emit('rpc.message', data);

    buildResponse(data, methods, this)
        .then(response => {
            if (response) this.connection.send(JSON.stringify(response));
        })
        .catch(e => { throw e; });
};

function onPong () {
    this.isAlive = true;
}

function onClose () {
    this.emit('rpc.close');
}

function onError (error) {
    this.emit('rpc.error', error);
}

class ConnectedClient extends EventEmitter {
    constructor (methods, connection) {
        super();

        this.isAlive = true;
        this.connection = connection;

        this.connection.on('message', onMessage(methods).bind(this));
        this.connection.on('pong', onPong.bind(this));
        this.connection.on('close', onClose.bind(this));
        this.connection.on('error', onError.bind(this));
    }

    get statusCode () {
        return this.connection.statusCode;
    }

    close (code, data) {
        this.connection.close(code, data);
    }

    buildMessage (method, params) {
        return { method, params, jsonrpc };
    }

    send (method, params, callback) {
        const payload = JSON.stringify(this.buildMessage(method, params));
        this.connection.send(payload, callback);
    }
}

module.exports = ConnectedClient;
