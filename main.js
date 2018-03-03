const WebSocket = require('ws');
const PassageClient = require('./src/client')(WebSocket);
const PassageServer = require('./src/server');

PassageClient.Server = PassageServer;

module.exports = PassageClient;
