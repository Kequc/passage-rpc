const EventEmitter = require('eventemitter3');
const PassageClient = require('./src/client')(WebSocket, EventEmitter);

module.exports = PassageClient;
