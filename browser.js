const PassageClient = require('./src/client')(WebSocket);

WebSocket.prototype.on = function (name, callback) {
    this.addEventListener(name, ({ data }) => { callback(data); });
};

module.exports = PassageClient;
