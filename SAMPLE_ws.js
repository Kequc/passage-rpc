const WebSocket = require('ws');

const _callbacks = {};
let _nextId = 1;

const WS_URI = process.env.WS_URI || 'ws://localhost:9090';

function buildError(params = {}) {
    const error = new Error(params.message);
    error.name = params.name;
    return error;
}

function runCallback(message) {
    if (_callbacks[message.id] === undefined) return;
    if (message.error) {
        const error = buildError(message.error);
        _callbacks[message.id](error);
    } else {
        _callbacks[message.id](undefined, message.result);
    }
    delete _callbacks[message.id];
}

function runTimeout(id) {
    if (_callbacks[id] === undefined) return;
    const error = buildError({
        name: 'Timeout',
        message: 'Something went wrong... please try again.'
    });
    _callbacks[id](error);
    delete _callbacks[id];
}

const ws = { connection: undefined, reconnectAttempts: 0 };

ws.connect = () => {
    if (ws.connection !== undefined) return;
    ws.connection = new WebSocket(WS_URI);
    ws.connection.on('close', _onClose);
    ws.connection.on('open', _onOpen);
    ws.connection.on('error', _onError);
    ws.connection.on('message', _onMessage);
};

ws.reconnect = () => {
    ws.connection = undefined;
    ws.reconnectAttempts += 1;
    ws.connect();
};

const SERVICE_UNAVAILABLE = new Error('Service unavailable');
SERVICE_UNAVAILABLE.name = 'ServiceUnavailable';
SERVICE_UNAVAILABLE.statusCode = 503;

ws.send = (method, params, callback) => {
    if (ws.connection === undefined) {
        if (typeof callback === 'function') callback(new Error('Connection error.'));
        return;
    }

    const id = _nextId++;
    const message = { id, method, params };
    console.log('out:', message);

    if (typeof callback === 'function') {
        _callbacks[id] = callback;
    }

    ws.connection.send(JSON.stringify(message), (error) => {
        if (_callbacks[id] !== undefined) {
            if (error) {
                _callbacks[id](SERVICE_UNAVAILABLE);
                delete _callbacks[id];
            }
            setTimeout(() => { runTimeout(id); }, 3000);
        } else if (error) {
            console.log('An unnoticed error occurred.');
            console.log(error);
        }
    });
};

function reconnectTimeout(reconnectAttempts) {
    switch (reconnectAttempts) {
    case 0: return 0;
    case 1: case 2: return 2500;
    case 3: case 4: case 5: return 5000;
    case 6: case 7: case 8: case 9: return 15000;
    default: return 60000;
    }
}

function _onClose() {
    console.log('CONNECTION CLOSED');
    const ms = reconnectTimeout(ws.reconnectAttempts);
    setTimeout(() => { ws.reconnect(); }, ms);
    console.log('Reconnecting in ' + ms + 'ms');
}

function _onOpen() {
    ws.reconnectAttempts = 0;
    console.log('Authenticating...');
    const params = {
        applicationId: process.env.APPLICATION_ID,
        secretKey: process.env.SECRET_KEY
    };
    ws.send('application.authenticate', params, (error) => {
        if (error) {
            console.log('Could not authenticate');
            console.log(error);
            return;
        }
        console.log('Authenticated');
    });
}

function _onError(error) {
    console.log('ERROR');
    console.error(error);
}

function _onMessage(data) {
    if (!data) return;

    const message = JSON.parse(data);
    console.log('in:', message);

    runCallback(message);
}

ws.connect();

module.exports = ws;
