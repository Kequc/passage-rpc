const EventEmitter = require('events');
const WebSocket = require('ws');
const jsonrpc = require('./version');

function getAttr (request, name) {
    if (typeof request === 'object') return request[name];
    return undefined;
}

const getPromise = (methods, ws) => request => {
    const method = getAttr(request, 'method');

    if (method === undefined || request.jsonrpc !== jsonrpc)
        return Promise.resolve(new Error('Invalid'));
    if (methods[method] === undefined)
        return Promise.resolve(new Error('Missing'));

    return Promise.resolve(methods[method](getAttr(request, 'params'), ws)).catch(e => e);
};

function getRequests (data) {
    try {
        const messages = JSON.parse(data);
        return (Array.isArray(messages) ? messages : [messages]);
    } catch (e) {
        return [];
    }
}

const buildResponse = ids => results => {
    const response = [];

    for (let i = 0; i < ids.length; i++) {
        const result = results[i];
        if (result instanceof Error) {
            const error = {
                message: result.message,
                code: result.code,
                data: result.data
            };
            response.push({ id: ids[i], error, jsonrpc });
        } else if (ids[i] !== null) {
            response.push({ id: ids[i], result, jsonrpc });
        }
    }

    return (response.length <= 1 ? response[0] : response);
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

function onListening () {
    this.emit('rpc.listening');
}

class Client extends EventEmitter {
    constructor (methods, ws) {
        super();

        this.isAlive = true;
        this.connection = ws;

        this.connection.on('message', (data) => {
            this.emit('rpc.message', data);

            const requests = getRequests(data);
            const ids = requests.map(request => getAttr(request, 'id') || null);
            const promises = requests.map(getPromise(methods, this));

            Promise.all(promises)
                .then(buildResponse(ids))
                .then(response => {
                    if (response) this.connection.send(JSON.stringify(response));
                })
                .catch(e => { throw e; });
        });

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

class PassageServer extends EventEmitter {
    constructor (options = {}, callback) {
        super();

        this.clients = new Set();

        const methods = options.methods || {};
        delete options.methods;

        this.socket = new WebSocket.Server(options, callback);

        this.socket.on('error', onError.bind(this));
        this.socket.on('listening', onListening.bind(this));

        this.socket.on('connection', (ws, req) => {
            const client = new Client(methods, ws);
            client.on('rpc.close', () => {
                this.clients.delete(client);
            });
            this.clients.add(client);
            this.emit('rpc.connection', client, req);
        });

        const heartrate = options.heartrate || 30000;
        this._interval = setInterval(this.heartbeat.bind(this), heartrate);
    }

    heartbeat () {
        for (const client of this.clients) {
            if (client.isAlive) {
                client.isAlive = false;
                client.connection.ping('', false, true);
            } else {
                client.connection.terminate();
            }
        }
    }

    close (callback) {
        clearInterval(this._interval);
        try {
            this.socket.close(callback);
        } catch (e) {
            if (callback) callback();
        }
    }
}

module.exports = PassageServer;
