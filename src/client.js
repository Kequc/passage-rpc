const EventEmitter = require('events');
const err = require('./util/err');
const Parser = require('./util/parser');
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

    if (error)
        this._callbacks[id](err.build(error));
    else
        this._callbacks[id](undefined, result);

    delete this._callbacks[id];
}

function onMessage (data) {
    this.emit('rpc.message', data);
    
    const parser = new Parser(data);
    if (parser.error()) return;

    for (const request of parser.requests) {
        if (typeof request !== 'object') continue;
        if (request.jsonrpc !== jsonrpc) continue;

        if (typeof request.method === 'string') {
            this.emit(request.method, request.params);
        } else if (request.id !== undefined) {
            runCallback.call(this, request.id, request.error, request.result);
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

        get readyState () {
            return this.connection.readyState;
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
            if (this.readyState !== 1) {
                const error = err.serviceUnavailable({ info: 'Connection not available.' });
                if (typeof params === 'function') callback = params;
                if (typeof callback !== 'function') throw error;
                callback(error);
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
