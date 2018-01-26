const EventEmitter = require('events');
const WebSocket = require('ws');

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

function onError (data) {
    this.emit('rpc.error', data);
}

function runCallback (id, error, result) {
    if (id !== undefined && this._callbacks[id] !== undefined) {
        if (error) {
            const err = new Error(error.message);
            err.code = error.code;
            err.data = error.data;
            this._callbacks[id](err);
        } else {
            this._callbacks[id](undefined, result);
        }
    }
    delete this._callbacks[id];
}

const TYPE = {
    INVALID: 'invalid',
    RESPONSE: 'response',
    NOTIFICATION: 'notification'
};

function messageType (message) {
    if (typeof message !== 'object') return TYPE.INVALID;
    if (message.jsonrpc !== '2.0') return TYPE.INVALID;
    if (message.method !== undefined) return TYPE.NOTIFICATION;
    if (message.id === undefined) return TYPE.INVALID;
    if (message.error !== undefined) return TYPE.RESPONSE;
    if (message.result !== undefined) return TYPE.RESPONSE;
    return TYPE.INVALID;
}

function onMessage (data) {
    this.emit('rpc.message', data);
    
    let messages;
    try {
        messages = JSON.parse(data);
        if (!Array.isArray(messages)) messages = [messages];
    } catch (e) {
        return;
    }
    
    for (const message of messages) {
        const type = messageType(message);
        switch (type) {
        case TYPE.NOTIFICATION:
            this.emit(message.method, message.params);
            break;
        case TYPE.RESPONSE:
            runCallback.call(this, message.id, message.error, message.result);
            break;
        }
    }
}

function runTimeout (id) {
    if (this._callbacks[id] === undefined) return;
    
    const error = new Error('Timeout');
    error.code = 408;

    this._callbacks[id](error);
    delete this._callbacks[id];
}

const numOrDef = (num, def) => (typeof num === 'number' ? num : def);

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
        this._events = {};

        this.connect();
    }

    close () {
        if (this.connection === undefined) return;
        this.connection.killed = true;
        this.connection.close();
    }

    connect () {
        this.close();
        this.connection = new WebSocket(this.uri);
        this.connection.addEventListener('open', onOpen.bind(this));
        this.connection.addEventListener('close', onClose.bind(this));
        this.connection.addEventListener('error', onError.bind(this));
        this.connection.addEventListener('message', onMessage.bind(this));
    }

    send (method, params, callback, timeout) {
        if (this.connection === undefined) {
            if (typeof callback === 'function') callback(new Error('No connection'));
            return;
        }

        const id = (typeof callback === 'function' ? this._nextId++ : undefined);

        let message;
        try {
            message = JSON.stringify({ id: id, method: method, params: params, jsonrpc: '2.0' });
        } catch (e) {
            if (typeof callback === 'function') callback(e);
            return;
        }

        if (typeof callback === 'function') {
            this._callbacks[id] = callback;
            const ms = numOrDef(timeout, this.options.requestTimeout);
            setTimeout(() => { runTimeout.call(this, id); }, ms);
        }

        this.connection.send(message);
    }
}

module.exports = PassageClient;
