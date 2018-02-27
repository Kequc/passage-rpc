const EventEmitter = require('events');
const expect = require('expect.js');
const { Server, WebSocket } = require('mock-socket');
const Passage = require('../src/client')(WebSocket, EventEmitter);
const jsonrpc = require('../src/version');

// mock ws library
WebSocket.prototype.on = WebSocket.prototype.addEventListener;

const URI = 'ws://fake-server.io';
const DEFAULT_OPTIONS = {
    requestTimeout: 6000,
    reconnect: false,
    reconnectTimeout: 2000,
    reconnectTries: 60
};

describe('client', () => {
    let server;

    beforeEach(() => {
        server = new Server(URI);
    });
    afterEach(done => {
        server.stop(done);
    });

    describe('defaults', () => {
        let passage;

        beforeEach(() => {
            passage = new Passage(URI);
        });

        it('should create an instance', () => {
            expect(passage.uri).to.equal(URI);
            expect(passage.options).to.eql(DEFAULT_OPTIONS);
            expect(passage.connection).to.be.a(WebSocket);
        });
        it('should have event emitter', () => {
            const name = 'my.event';
            const handler = () => {};
            passage.on(name, handler);
            expect(passage.listenerCount(name)).to.equal(1);
            expect(passage.listeners(name)[0]).to.equal(handler);
            passage.removeListener(name, handler);
            expect(passage.listenerCount(name)).to.equal(0);
        });
    });

    describe('custom options', () => {
        it('should create an instance with custom options', () => {
            const options = {
                requestTimeout: 600,
                reconnect: true,
                reconnectTimeout: 200,
                reconnectTries: 6
            };
            const passage = new Passage(URI, options);
            expect(passage.uri).to.equal(URI);
            expect(passage.options).to.eql(options);
            expect(passage.connection).to.be.a(WebSocket);
            passage.close();
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
                const passage = new Passage(URI, options);
                expect(passage.uri).to.equal(URI);
                expect(passage.options).to.eql(DEFAULT_OPTIONS);
            }
        });
        it('should reconnect', done => {
            const passage = new Passage(URI, { reconnect: true, reconnectTimeout: 0 });
            let count = 0;
            passage.on('rpc.open', () => {
                if (count === 0) {
                    server.close();
                } else {
                    done();
                    passage.close();
                }
            });
            passage.on('rpc.close', () => {
                if (count === 2) server = new Server(URI);
                count++;
            });
        });
    });

    describe('events', () => {
        let passage;

        beforeEach(() => {
            passage = new Passage(URI);
        });

        it('should trigger rpc.open on connection', done => {
            passage.on('rpc.open', done);
        });
        it('should trigger rpc.close on close', done => {
            passage.on('rpc.open', () => { passage.close(); });
            passage.on('rpc.close', done);
        });
        it('should trigger rpc.error on error', done => {
            passage.on('rpc.error', () => { done(); });
            server.simulate('error');
        });
        it('should trigger rpc.message on message', done => {
            const text = 'some text';
            passage.on('rpc.message', (message) => {
                expect(message).to.equal(text);
                done();
            });
            passage.on('rpc.open', () => { server.send(text); });
        });
    });

    describe('notifications', () => {
        let passage;
        const method = 'myapp.notification';

        beforeEach(() => {
            passage = new Passage(URI);
        });

        it('should receive a notification', done => {
            const params = { some: 'data' };
            passage.on(method, received => {
                expect(received).to.eql(params);
                done();
            });
            passage.on('rpc.open', () => {
                server.send(JSON.stringify({ method, params, jsonrpc }));
            });
        });
        it('should send a notification', done => {
            server.on('message', data => {
                expect(JSON.parse(data)).to.eql({ method, jsonrpc });
                done();
            });
            passage.on('rpc.open', () => {
                passage.send(method);
            });
        });
        it('should send a notification with params', done => {
            const params = { some: 'data' };
            server.on('message', data => {
                expect(JSON.parse(data)).to.eql({ method, params, jsonrpc });
                done();
            });
            passage.on('rpc.open', () => {
                passage.send(method, params);
            });
        });
    });

    describe('responses', () => {
        let passage;
        const method = 'myapp.response';

        beforeEach(() => {
            passage = new Passage(URI);
        });

        it('should receive a response', done => {
            const expected = { some: 'data' };
            server.on('message', data => {
                expect(JSON.parse(data)).to.eql({ id: 1, method, jsonrpc });
                server.send(JSON.stringify({ id: 1, result: expected, jsonrpc }));
            });
            passage.on('rpc.open', () => {
                passage.send(method, (error, result) => {
                    expect(error).to.be(undefined);
                    expect(result).to.eql(expected);
                    done();
                });
            });
        });
        it('should increment id', done => {
            let id = 1;
            server.on('message', data => {
                expect(JSON.parse(data).id).to.equal(id);
                server.send(JSON.stringify({ id, result: true, jsonrpc }));
                id++;
            });
            passage.on('rpc.open', () => {
                passage.send(method, () => {
                    passage.send(method, () => {
                        passage.send(method, () => {
                            done();
                        });
                    });
                });
            });
        });
        it('should receive an error', done => {
            const error = { code: 500, message: 'an error!', data: { hmm: 'oops' } };
            server.on('message', data => {
                expect(JSON.parse(data)).to.eql({ id: 1, method, jsonrpc });
                server.send(JSON.stringify({ id: 1, error, jsonrpc }));
            });
            passage.on('rpc.open', () => {
                passage.send(method, (error, result) => {
                    expect(error).to.be.an(Error);
                    expect(error.message).to.equal(error.message);
                    expect(error.code).to.equal(error.code);
                    expect(error.data).to.eql(error.data);
                    expect(result).to.be(undefined);
                    done();
                });
            });
        });
        it('should timeout on no response', done => {
            passage.on('rpc.open', () => {
                passage.send(method, (error, result) => {
                    expect(error).to.be.an(Error);
                    expect(error.message).to.equal('Timeout');
                    expect(error.code).to.equal(408);
                    expect(error.data).to.be(undefined);
                    expect(result).to.be(undefined);
                    done();
                }, 0); // timeout set to 0 for faster test
            });
        });
    });

    describe('utilities', () => {
        let passage;
        const method = 'method.name';
        const params = 'some text';

        beforeEach(() => {
            passage = new Passage(URI);
        });

        it('should not expect a response', () => {
            const id = passage.expectResponse(undefined, 0);
            expect(id).to.equal(undefined);
        });
        it('should expect a response', done => {
            const callback = (err) => {
                expect(err).to.be.a(Error);
                done();
            };
            const id = passage.expectResponse(callback, 0);
            expect(id).to.equal(1);
        });
        it('should build a message', () => {
            const expected = { id: undefined, method, params, jsonrpc };
            expect(passage.buildMessage(method, params)).to.eql(expected);
        });
        it('should build a message that sets a callback', done => {
            const callback = (err) => {
                expect(err).to.be.a(Error);
                done();
            };
            const expected = { id: 1, method, params, jsonrpc };
            expect(passage.buildMessage(method, params, callback, 0)).to.eql(expected);
        });
        it('should increment id', done => {
            const callback2 = (err) => {
                expect(err).to.be.a(Error);
                done();
            };
            const callback1 = (err) => {
                expect(err).to.be.a(Error);
                expect(passage.buildMessage(method, params, callback2, 0).id).to.equal(2);
            };
            expect(passage.buildMessage(method, params, callback1, 0).id).to.equal(1);
        });
    });
});
