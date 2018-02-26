const WebSocket = require('ws');
const PassageClient = require('./src/client')(WebSocket);
const PassageServer = require('./src/server')(WebSocket);

PassageClient.Server = PassageServer;

module.exports = PassageClient;
