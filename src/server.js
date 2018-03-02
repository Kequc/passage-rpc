const EventEmitter = require('events');
const WebSocket = require('ws');
const jsonrpc = require('./version');

function onPong () {
    this.isAlive = true;
}

function getAttr (message, name) {
    if (typeof message === 'object') return message[name];
    return undefined;
}

const getPromise = (methods, ws) => message => {
    const method = getAttr(message, 'method');

    if (method === undefined || message.jsonrpc !== jsonrpc)
        return Promise.resolve(new Error('Invalid'));
    if (methods[method] === undefined)
        return Promise.resolve(new Error('Missing'));

    return Promise.resolve(methods[method](getAttr(message, 'params'), ws))
        .catch(e => e);
};

const buildMessage = (method, params) => ({ method, params, jsonrpc });

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

const onMessage = events => function (data) {
    this.emit('rpc.message', data);

    let messages;
    try {
        messages = JSON.parse(data);
        if (!Array.isArray(messages)) messages = [messages];
    } catch (e) {
        return;
    }

    const ids = messages.map(message => getAttr(message, 'id') || null);
    const promises = messages.map(getPromise(events, this));

    Promise.all(promises)
        .then(buildResponse(ids))
        .then(response => {
            if (response) this.send(JSON.stringify(response));
        })
        .catch(e => { throw e; });
};

function onClose () {
    this.emit('rpc.close');
}

function onListening () {
    this.emit('rpc.listening');
}

function onError (error) {
    this.emit('rpc.error', error);
}

function notify (method, params, callback) {
    const payload = JSON.stringify(this.buildMessage(method, params));
    this.send(payload, callback);
}

class PassageServer extends EventEmitter {
    constructor (options = {}, callback) {
        super();

        const heartrate = options.heartrate || 30000;
        delete options.heartrate;
        const methods = options.methods || {};
        delete options.methods;

        this.socket = new WebSocket.Server(options, callback);
        this.socket.on('listening', onListening.bind(this));
        this.socket.on('error', onError.bind(this));
        this.socket.on('connection', (ws, req) => {
            ws.isAlive = true;
            ws.buildMessage = buildMessage;
            ws.notify = notify;
            ws.on('pong', onPong);
            ws.on('message', onMessage(methods));
            ws.on('close', onClose);
            ws.on('error', onError);
            this.emit('rpc.connection', ws, req);
        });

        this._interval = setInterval(() => {
            for (const client of this.socket.clients) {
                if (client.isAlive) {
                    client.isAlive = false;
                    client.ping('', false, true);
                } else {
                    client.terminate();
                }
            }
        }, heartrate);
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
