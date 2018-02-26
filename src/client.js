const EventEmitter = require('events');

const jsonrpc = '2.0';

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

function onError (event) {
    this.emit('rpc.error', event);
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

function onMessage (event) {
    this.emit('rpc.message', event.data);
    
    let messages;
    try {
        messages = JSON.parse(event.data);
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

function buildMessages (arr) {
    const result = [];

    for (const obj of arr) {
        if (typeof obj !== 'object' || typeof obj.method !== 'string') {
            if (typeof obj.callback === 'function') obj.callback(new Error('Invalid payload'));
            continue;
        }

        const data = {
            id: (typeof obj.callback === 'function' ? this._nextId++ : undefined),
            method: obj.method,
            params: obj.params,
            jsonrpc
        };

        result.push({ id: data.id, payload: JSON.stringify(data), callback: obj.callback });
    }

    return result;
}

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
            this.connection.on('open', onOpen.bind(this));
            this.connection.on('close', onClose.bind(this));
            this.connection.on('error', onError.bind(this));
            this.connection.on('message', onMessage.bind(this));
        }

        sendAll (arr, timeout) {
            if (this.connection === undefined) {
                for (const obj of arr) {
                    if (typeof obj.callback === 'function') obj.callback(new Error('No connection'));
                }
                return;
            }

            const messages = buildMessages.call(this, arr);

            for (const message of messages) {
                if (message.id !== undefined) {
                    this._callbacks[message.id] = message.callback;
                    const ms = numOrDef(timeout, this.options.requestTimeout);
                    setTimeout(() => { runTimeout.call(this, message.id); }, ms);
                }
            }

            if (messages.length > 1) {
                this.connection.send('[' + messages.map(message => message.payload).join(',') + ']');
            } else if (messages.length === 1) {
                this.connection.send(messages[0].payload);
            }
        }

        send (method, params, callback, timeout) {
            if (typeof params === 'function') {
                timeout = callback;
                callback = params;
                params = undefined;
            }
            this.sendAll([{ method, params, callback }], timeout);
        }
    }

    return PassageClient;
};
