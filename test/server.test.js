const expect = require('expect.js');
const WebSocket = require('ws');
const PassageServer = require('../src/server');
// const jsonrpc = require('../src/version');

const PORT = 9000;
const URI = `ws://localhost:${PORT}`;

describe('server', () => {
    let client;

    beforeEach(() => {
        client = new WebSocket(URI);
        client.on('error', () => {});
    });

    describe('defaults', () => {
        let server;

        beforeEach(() => {
            server = new PassageServer({ port: PORT });
        });
        afterEach(done => {
            server.close(done);
        });

        it('should create an instance', () => {
            expect(server.socket).to.be.a(WebSocket.Server);
        });
    });
});
