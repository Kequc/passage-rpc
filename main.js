const EventEmitter = require('events');
const WebSocket = require('ws');
const PassageClient = require('./src/client')(EventEmitter, WebSocket);
const PassageServer = require('./src/server');

PassageClient.Server = PassageServer;

module.exports = PassageClient;
