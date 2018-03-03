const EventEmitter = require('events');
const err = require('./util/err');
const jsonrpc = require('./version');

function onOpen () {
    this._tries = 0;
    this.emit('rpc.open');
}

function onClose () {
    if (this.options.reconnect && !this.connection.killed && this._tries <= this.options.reconnectTries) {
        this._tries++;
        setTimeout(() => { this.connect(); }, this.options.reconnectTimeout);
    }
    this.emit('rpc.close');
}

function onError (error) {
    this.emit('rpc.error', error);
}

function runCallback (id, error, result) {
    clearTimeout(this._timeouts[id]);
    delete this._timeouts[id];

    if (id === undefined || this._callbacks[id] === undefined) return;

    if (error) {
        const err = new Error(error.message);
        err.name = error.name;
        err.code = error.code;
        err.data = error.data;
        this._callbacks[id](err);
    } else {
        this._callbacks[id](undefined, result);
    }

    delete this._callbacks[id];
}

function getMessages (data) {
    try {
        const messages = JSON.parse(data);
        return (Array.isArray(messages) ? messages : [messages]);
    } catch (e) {
        return [];
    }
}

function onMessage (data) {
    this.emit('rpc.message', data);
    
    for (const message of getMessages(data)) {
        if (typeof message !== 'object') continue;
        if (message.jsonrpc !== jsonrpc) continue;

        if (message.method !== undefined) {
            this.emit(message.method, message.params);
        } else if (message.id !== undefined) {
            runCallback.call(this, message.id, message.error, message.result);
        }
    }
}

function runTimeout (id) {
    clearTimeout(this._timeouts[id]);
    delete this._timeouts[id];

    if (id === undefined || this._callbacks[id] === undefined) return;
    
    this._callbacks[id](err.timeout({ info: 'Server did not respond in time.' }));
    delete this._callbacks[id];
}

const numOrDef = (num, def) => (typeof num === 'number' ? num : def);

module.exports = (WebSocket) => {
    class PassageClient extends EventEmitter {
        constructor (uri, options = {}) {
            super();

            this.uri = uri;
            this.options = {
                requestTimeout: numOrDef(options.requestTimeout, 6000),
                reconnect: !!options.reconnect,
                reconnectTimeout: numOrDef(options.reconnectTimeout, 2000),
                reconnectTries: numOrDef(options.reconnectTries, 60)
            };

            this._nextId = 1;
            this._tries = 0;
            this._callbacks = {};
            this._timeouts = {};

            this.connect();
        }

        get statusCode () {
            return this.connection.statusCode;
        }

        close () {
            if (this.connection === undefined) return;

            this.connection.killed = true;
            this.connection.close();
        }

        connect () {
            this.close();
            this.connection = new WebSocket(this.uri);
            this.connection.on('open', onOpen.bind(this));
            this.connection.on('close', onClose.bind(this));
            this.connection.on('error', onError.bind(this));
            this.connection.on('message', onMessage.bind(this));
        }

        expectResponse (callback, timeout) {
            if (typeof callback !== 'function') return undefined;

            const id = this._nextId++;
            this._callbacks[id] = callback;
            const ms = numOrDef(timeout, this.options.requestTimeout);
            this._timeouts[id] = setTimeout(() => { runTimeout.call(this, id); }, ms);

            return id;
        }

        buildMessage (method, params, callback, timeout) {
            if (typeof params === 'function') {
                timeout = callback;
                callback = params;
                params = undefined;
            }
            return {
                id: this.expectResponse(callback, timeout),
                method,
                params,
                jsonrpc
            };
        }

        send (method, params, callback, timeout) {
            if (this.connection.readyState !== PassageClient.OPEN) {
                const err = err.serviceUnavailable({ info: 'Connection not available.' });
                if (typeof params === 'function') callback = params;
                if (typeof callback !== 'function') throw err;
                callback(err);
                return;
            }
            const payload = JSON.stringify(this.buildMessage(method, params, callback, timeout));
            this.connection.send(payload);
        }
    }

    PassageClient.CONNECTING = 0;
    PassageClient.OPEN = 1;
    PassageClient.CLOSING = 2;
    PassageClient.CLOSED = 3;

    return PassageClient;
};
