const EventEmitter = require('eventemitter3');
const PassageClient = require('./src/client')(EventEmitter, WebSocket);

module.exports = PassageClient;
