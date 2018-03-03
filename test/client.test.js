const expect = require('expect.js');
const WebSocket = require('ws');
const PassageClient = require('../src/client')(WebSocket);
const jsonrpc = require('../src/version');

const PORT = 9000;
const URI = `ws://localhost:${PORT}`;
const DEFAULT_OPTIONS = {
    requestTimeout: 6000,
    reconnect: false,
    reconnectTimeout: 2000,
    reconnectTries: 60
};

describe('client', () => {
    let server;

    beforeEach(done => {
        server = new WebSocket.Server({ port: PORT }, done);
    });
    afterEach(done => {
        server.close(done);
    });

    describe('constructor', () => {
        it('should create an instance', () => {
            const client = new PassageClient(URI);
            expect(client.uri).to.equal(URI);
            expect(client.options).to.eql(DEFAULT_OPTIONS);
            expect(client.connection).to.be.a(WebSocket);
        });
        it('should have event emitter', () => {
            const client = new PassageClient(URI);
            const name = 'my.event';
            const handler = () => {};
            client.on(name, handler);
            expect(client.listenerCount(name)).to.equal(1);
            expect(client.listeners(name)[0]).to.equal(handler);
            client.removeListener(name, handler);
            expect(client.listenerCount(name)).to.equal(0);
        });
        it('should create an instance with custom options', () => {
            const options = {
                requestTimeout: 600,
                reconnect: true,
                reconnectTimeout: 200,
                reconnectTries: 6
            };
            const client = new PassageClient(URI, options);
            expect(client.uri).to.equal(URI);
            expect(client.options).to.eql(options);
            expect(client.connection).to.be.a(WebSocket);
        });
        it('should ignore invalid input', () => {
            const NOT_NUMBERS = ['1', null, true, false, () => {}, undefined];
            for (const value of NOT_NUMBERS) {
                const options = {
                    requestTimeout: value,
                    reconnect: false,
                    reconnectTimeout: value,
                    reconnectTries: value
                };
                const client = new PassageClient(URI, options);
                expect(client.uri).to.equal(URI);
                expect(client.options).to.eql(DEFAULT_OPTIONS);
            }
        });
        it('should reconnect', done => {
            const client = new PassageClient(URI, { reconnect: true, reconnectTimeout: 0 });
            let count = 0;
            client.on('rpc.open', () => {
                if (count === 0) {
                    server.close();
                } else {
                    done();
                    client.close();
                }
            });
            client.on('rpc.close', () => {
                if (count === 2) server = new WebSocket.Server({ port: PORT });
                count++;
            });
        });
    });

    describe('events', () => {
        let client;

        beforeEach(() => {
            client = new PassageClient(URI);
        });

        it('should trigger rpc.open on connection', done => {
            client.on('rpc.open', done);
        });
        it('should trigger rpc.close on close', done => {
            client.on('rpc.open', () => { client.close(); });
            client.on('rpc.close', done);
        });
        it('should trigger rpc.error on error', done => {
            client.on('rpc.error', (e) => {
                expect(e).to.be.a(Error);
                done();
            });
            server.close();
        });
        it('should trigger rpc.message on message', done => {
            const text = 'some text';
            client.on('rpc.message', (message) => {
                expect(message).to.equal(text);
                done();
            });
            server.on('connection', (ws) => { ws.send(text); });
        });
    });

    describe('notifications', () => {
        let client;
        const method = 'myapp.notification';

        beforeEach(() => {
            client = new PassageClient(URI);
        });

        it('should receive a notification', done => {
            const params = { some: 'data' };
            client.on(method, received => {
                expect(received).to.eql(params);
                done();
            });
            server.on('connection', (ws) => {
                ws.send(JSON.stringify({ method, params, jsonrpc }));
            });
        });
        it('should receive a notification with params', done => {
            client.on(method, received => {
                expect(received).to.be(undefined);
                done();
            });
            server.on('connection', (ws) => {
                ws.send(JSON.stringify({ method, jsonrpc }));
            });
        });
        it('should send a notification', done => {
            server.on('connection', (ws) => {
                ws.on('message', data => {
                    expect(JSON.parse(data)).to.eql({ method, jsonrpc });
                    done();
                });
            });
            client.on('rpc.open', () => {
                client.send(method);
            });
        });
        it('should send a notification with params', done => {
            const params = { some: 'data' };
            server.on('connection', (ws) => {
                ws.on('message', data => {
                    expect(JSON.parse(data)).to.eql({ method, params, jsonrpc });
                    done();
                });
            });
            client.on('rpc.open', () => {
                client.send(method, params);
            });
        });
    });

    describe('responses', () => {
        let client;
        const method = 'myapp.response';

        beforeEach(() => {
            client = new PassageClient(URI);
        });

        it('should receive a response', done => {
            server.on('connection', (ws) => {
                ws.on('message', data => {
                    expect(JSON.parse(data)).to.eql({ id: 1, method, jsonrpc });
                    ws.send(JSON.stringify({ id: 1, jsonrpc }));
                });
            });
            client.on('rpc.open', () => {
                client.send(method, (error, response) => {
                    expect(error).to.be(undefined);
                    expect(response).to.be(undefined);
                    done();
                });
            });
        });
        it('should receive a response with params', done => {
            const expected = { some: 'data' };
            server.on('connection', (ws) => {
                ws.on('message', data => {
                    expect(JSON.parse(data)).to.eql({ id: 1, method, jsonrpc });
                    ws.send(JSON.stringify({ id: 1, result: expected, jsonrpc }));
                });
            });
            client.on('rpc.open', () => {
                client.send(method, (error, response) => {
                    expect(error).to.be(undefined);
                    expect(response).to.eql(expected);
                    done();
                });
            });
        });
        it('should increment id', done => {
            let id = 1;
            server.on('connection', (ws) => {
                ws.on('message', data => {
                    expect(JSON.parse(data).id).to.equal(id);
                    ws.send(JSON.stringify({ id, result: true, jsonrpc }));
                    id++;
                });
            });
            client.on('rpc.open', () => {
                client.send(method, () => {
                    client.send(method, () => {
                        client.send(method, () => {
                            done();
                        });
                    });
                });
            });
        });
        it('should receive an error', done => {
            const error = { code: 500, message: 'an error!', data: { hmm: 'oops' } };
            server.on('connection', (ws) => {
                ws.on('message', data => {
                    expect(JSON.parse(data)).to.eql({ id: 1, method, jsonrpc });
                    ws.send(JSON.stringify({ id: 1, error, jsonrpc }));
                });
            });
            client.on('rpc.open', () => {
                client.send(method, (error, response) => {
                    expect(error).to.be.an(Error);
                    expect(error.message).to.equal(error.message);
                    expect(error.code).to.equal(error.code);
                    expect(error.data).to.eql(error.data);
                    expect(response).to.be(undefined);
                    done();
                });
            });
        });
        it('should timeout on no response', done => {
            client.on('rpc.open', () => {
                client.send(method, (error, response) => {
                    expect(error).to.be.an(Error);
                    expect(error.name).to.equal('Timeout');
                    expect(error.code).to.equal(408);
                    expect(response).to.be(undefined);
                    done();
                }, 0); // timeout set to 0 for faster test
            });
        });
    });

    describe('utilities', () => {
        let client;
        const method = 'method.name';
        const params = 'some text';

        beforeEach(() => {
            // timeout set to 0 for faster test
            client = new PassageClient(URI, { requestTimeout: 0 });
        });

        it('should not expect a response', () => {
            const id = client.expectResponse(undefined);
            expect(id).to.be(undefined);
        });
        it('should expect a response', done => {
            const callback = (error) => {
                expect(error).to.be.a(Error);
                done();
            };
            const id = client.expectResponse(callback);
            expect(id).to.equal(1);
        });
        it('should build a message', () => {
            const expected = { id: undefined, method, params, jsonrpc };
            expect(client.buildMessage(method, params)).to.eql(expected);
        });
        it('should build a message that sets a callback', done => {
            const callback = (error) => {
                expect(error).to.be.a(Error);
                done();
            };
            const expected = { id: 1, method, params, jsonrpc };
            expect(client.buildMessage(method, params, callback)).to.eql(expected);
        });
        it('should increment id', done => {
            const callback2 = (error) => {
                expect(error).to.be.a(Error);
                done();
            };
            const callback1 = (error) => {
                expect(error).to.be.a(Error);
                expect(client.buildMessage(method, params, callback2).id).to.equal(2);
            };
            expect(client.buildMessage(method, params, callback1).id).to.equal(1);
        });
    });

    describe('multi message', () => {
        let client;

        beforeEach(() => {
            client = new PassageClient(URI);
        });

        it('should receive multiple notifications', done => {
            const result = {};
            function finish () {
                expect(result).to.eql(expected);
                done();
            }
            const expected = {
                method1: { some: 'data' },
                method2: 'some text'
            };
            let count = 0;
            client.on('method1', (received) => {
                count++; result.method1 = received;
                if (count === 2) finish();
            });
            client.on('method2', (received) => {
                count++; result.method2 = received;
                if (count === 2) finish();
            });
            server.on('connection', (ws) => {
                ws.send(JSON.stringify([
                    { method: 'method1', params: expected.method1, jsonrpc },
                    { method: 'method2', params: expected.method2, jsonrpc }
                ]));
            });
        });
    });
});
