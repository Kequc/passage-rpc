const PassageClient = require('./src/client');
const PassageServer = require('./src/server');

PassageClient.Server = PassageServer;

module.exports = PassageClient;
