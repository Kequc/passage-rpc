const EventEmitter = require('events');
const WebSocket = require('ws');
const PassageClient = require('./src/client')(WebSocket, EventEmitter);
const PassageServer = require('./src/server')(WebSocket, EventEmitter);

PassageClient.Server = PassageServer;

module.exports = PassageClient;
