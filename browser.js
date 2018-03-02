const PassageClient = require('./src/client')(WebSocket);

WebSocket.prototype.on = (name, callback) => {
    WebSocket.prototype.addEventListener(name, ({ data }) => callback(data));
};

module.exports = PassageClient;
