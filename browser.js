const EventEmitter = require('eventemitter3');
const PassageClient = require('./src/client')(EventEmitter, WebSocket);

WebSocket.prototype.on = WebSocket.prototype.addEventListener;

module.exports = PassageClient;
