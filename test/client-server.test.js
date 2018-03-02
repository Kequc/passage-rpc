const EventEmitter = require('events');
const expect = require('expect.js');
const WebSocket = require('ws');
const PassageServer = require('../src/server');
const PassageClient = require('../src/client')(EventEmitter, WebSocket);

const PORT = 9000;
const URI = `ws://localhost:${PORT}`;

describe('client-server', () => {
    let server;
    let client;

    function buildServer (methods, ready) {
        if (typeof methods === 'function') {
            ready = methods;
            methods = undefined;
        }
        server = new PassageServer({ port: PORT, methods }, () => {
            client = new PassageClient(URI);
            ready();
        });
    }

    afterEach(done => {
        server.close(done);
        server = undefined;
        client = undefined;
    });

    it('should create a connection', done => {
        buildServer(() => {
            server.on('rpc.connection', () => {
                client.on('rpc.open', done);
            });
        });
    });
    it('client should send a notification', done => {
        const method = 'myapp.notification';
        const methods = { [method]: (result) => {
            expect(result).to.be(undefined);
            done();
        } };
        buildServer(methods, () => {
            client.on('rpc.open', () => {
                client.send(method);
            });
        });
    });
    it('client should send a notification with params', done => {
        const method = 'myapp.notification';
        const params = { hi: 'there' };
        const methods = { [method]: (result) => {
            expect(result).to.eql(params);
            done();
        } };
        buildServer(methods, () => {
            client.on('rpc.open', () => {
                client.send(method, params);
            });
        });
    });
    it('server should send a notification', done => {
        const method = 'myapp.notification';
        buildServer(() => {
            client.on(method, (result) => {
                expect(result).to.be(undefined);
                done();
            });
            server.on('rpc.connection', (ws) => {
                ws.send(method);
            });
        });
    });
    it('server should send a notification with params', done => {
        const method = 'myapp.notification';
        const params = { hi: 'there' };
        buildServer(() => {
            client.on(method, (result) => {
                expect(result).to.eql(params);
                done();
            });
            server.on('rpc.connection', (ws) => {
                ws.send(method, params);
            });
        });
    });
    it('server should respond to a request', done => {
        const method = 'myapp.request';
        const methods = { [method]: () => {} };
        buildServer(methods, () => {
            client.on('rpc.open', () => {
                client.send(method, (err, result) => {
                    expect(err).to.be(undefined);
                    expect(result).to.be(undefined);
                    done();
                });
            });
        });
    });
    it('server should respond to a request with params', done => {
        const method = 'myapp.request';
        const params = { some: 'data' };
        const response = { a: 'response' };
        const methods = { [method]: (result, ws) => {
            expect(result).to.eql(params);
            expect(ws.connection).to.be.a(WebSocket);
            return response;
        } };
        buildServer(methods, () => {
            client.on('rpc.open', () => {
                client.send(method, params, (err, result) => {
                    expect(err).to.be(undefined);
                    expect(result).to.eql(response);
                    done();
                });
            });
        });
    });
});
