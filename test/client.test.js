const expect = require('expect.js');
const { Server, WebSocket } = require('mock-socket');
const Passage = require('../src/client')(WebSocket);

// mock-socket server side
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
    afterEach(() => {
        server.close();
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
});
