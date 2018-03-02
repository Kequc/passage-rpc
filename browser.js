const PassageClient = require('./src/client')(WebSocket);

WebSocket.prototype.on = WebSocket.prototype.addEventListener;

module.exports = PassageClient;
