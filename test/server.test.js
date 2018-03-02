const expect = require('expect.js');
const WebSocket = require('ws');
const PassageServer = require('../src/server');
const jsonrpc = require('../src/version');

const PORT = 9000;
const URI = `ws://localhost:${PORT}`;

describe('server', () => {
    let server;
    let client;

    function buildServer (methods, ready) {
        if (typeof methods === 'function') {
            ready = methods;
            methods = undefined;
        }
        server = new PassageServer({ port: PORT, methods }, () => {
            client = new WebSocket(URI);
            client.on('error', () => {}); // must define error handler
            ready();
        });
    }

    afterEach(done => {
        server.close(done);
        server = undefined;
        client = undefined;
    });

    describe('constructor', () => {
        it('should create an instance', done => {
            buildServer(() => {
                expect(server.socket).to.be.a(WebSocket.Server);
                done();
            });
        });
        it('should have an event emitter', done => {
            buildServer(() => {
                const name = 'my.event';
                const handler = () => {};
                server.on(name, handler);
                expect(server.listenerCount(name)).to.equal(1);
                expect(server.listeners(name)[0]).to.equal(handler);
                server.removeListener(name, handler);
                expect(server.listenerCount(name)).to.equal(0);
                done();
            });
        });
    });

    describe('events', () => {
        beforeEach(buildServer);

        it('should trigger rpc.connection on connection', done => {
            server.on('rpc.connection', (ws, req) => {
                expect(ws).to.be.a(WebSocket);
                expect(req).to.be.a(Object);
                done();
            });
        });
        it('should trigger rpc.error on error', done => {
            server.on('rpc.error', (e) => {
                expect(e).to.be.a(Error);
                done();
            });
            server.socket.emit('error', new Error());
        });
        it('should trigger rpc.listening on listening', done => {
            server.on('rpc.listening', done);
        });
        it('should trigger ws rpc.close on close', done => {
            server.on('rpc.connection', (ws) => {
                ws.on('rpc.close', done);
                ws.close();
            });
        });
        it('should trigger ws rpc.error on error', done => {
            server.on('rpc.connection', (ws) => {
                ws.on('rpc.error', (e) => {
                    expect(e).to.be.a(Error);
                    done();
                });
                ws.emit('error', new Error());
            });
        });
        it('should trigger ws rpc.message on message', done => {
            const text = 'some text';
            server.on('rpc.connection', (ws) => {
                ws.on('rpc.message', (message) => {
                    expect(message).to.equal(text);
                    done();
                });
            });
            client.on('open', () => { client.send(text); });
        });
    });

    describe('notifications', () => {
        const method = 'myapp.notification';

        it('should receive a notification', done => {
            const params = { some: 'data' };
            const methods = { [method]: (received) => {
                expect(received).to.eql(params);
                done();
            } };
            buildServer(methods, () => {
                client.on('open', () => {
                    client.send(JSON.stringify({ method, params, jsonrpc }));
                });
            });
        });
        it('should send a notification', done => {
            buildServer(() => {
                client.on('message', data => {
                    expect(JSON.parse(data)).to.eql({ method, jsonrpc });
                    done();
                });
                server.on('rpc.connection', (ws) => {
                    ws.notify(method);
                });
            });
        });
        it('should send a notification with params', done => {
            const params = { some: 'data' };
            buildServer(() => {
                client.on('message', data => {
                    expect(JSON.parse(data)).to.eql({ method, params, jsonrpc });
                    done();
                });
                server.on('rpc.connection', (ws) => {
                    ws.notify(method, params);
                });
            });
        });
    });

    describe('responses', () => {
        const method = 'myapp.response';

        it('should send a response', done => {
            const expected = { some: 'data' };
            const methods = { [method]: () => expected };
            buildServer(methods, () => {
                client.on('message', (data) => {
                    expect(JSON.parse(data)).to.eql({ id: 1, result: expected, jsonrpc });
                    done();
                });
                client.on('open', () => {
                    client.send(JSON.stringify({ id: 1, method, jsonrpc }));
                });
            });
        });
        it('should send an error', done => {
            const expected = { code: 500, message: 'an error!', data: { hmm: 'oops' } };
            const error = new Error(expected.message);
            error.code = expected.code;
            error.data = expected.data;
            const methods = { [method]: () => error };
            buildServer(methods, () => {
                client.on('message', (data) => {
                    expect(JSON.parse(data)).to.eql({ id: 1, error: expected, jsonrpc });
                    done();
                });
                client.on('open', () => {
                    client.send(JSON.stringify({ id: 1, method, jsonrpc }));
                });
            });
        });
    });

    describe('promises', () => {
        const method = 'myapp.promise';

        it('should send a response', done => {
            const expected = { some: 'data' };
            const methods = { [method]: () => Promise.resolve(expected) };
            buildServer(methods, () => {
                client.on('message', (data) => {
                    expect(JSON.parse(data)).to.eql({ id: 1, result: expected, jsonrpc });
                    done();
                });
                client.on('open', () => {
                    client.send(JSON.stringify({ id: 1, method, jsonrpc }));
                });
            });
        });
        it('should send an error', done => {
            const expected = { code: 500, message: 'an error!', data: { hmm: 'oops' } };
            const error = new Error(expected.message);
            error.code = expected.code;
            error.data = expected.data;
            const methods = { [method]: () => Promise.reject(error) };
            buildServer(methods, () => {
                client.on('message', (data) => {
                    expect(JSON.parse(data)).to.eql({ id: 1, error: expected, jsonrpc });
                    done();
                });
                client.on('open', () => {
                    client.send(JSON.stringify({ id: 1, method, jsonrpc }));
                });
            });
        });
    });
});
