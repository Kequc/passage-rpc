// const EventEmitter = require('events');
// const expect = require('expect.js');
// const { Server, WebSocket } = require('mock-socket');
// const Passage = require('../src/server')(EventEmitter, Server);
// // const jsonrpc = require('../src/version');

// // mock ws library
// WebSocket.prototype.on = WebSocket.prototype.addEventListener;

// const URI = 'ws://fake-server.io';
// const DEFAULT_OPTIONS = {
//     requestTimeout: 6000,
//     reconnect: false,
//     reconnectTimeout: 2000,
//     reconnectTries: 60
// };

// describe('client', () => {
//     let server;

//     beforeEach(() => {
//         server = new Server(URI);
//     });
//     afterEach(done => {
//         server.stop(done);
//     });

//     describe('defaults', () => {
//         let passage;

//         beforeEach(() => {
//             passage = new Passage(URI);
//         });

//         it('should create an instance', () => {
//             expect(passage.uri).to.equal(URI);
//             expect(passage.requestTimeout).to.equal(DEFAULT_OPTIONS.requestTimeout);
//             expect(passage.reconnect).to.equal(DEFAULT_OPTIONS.reconnect);
//             expect(passage.reconnectTimeout).to.equal(DEFAULT_OPTIONS.reconnectTimeout);
//             expect(passage.reconnectTries).to.equal(DEFAULT_OPTIONS.reconnectTries);
//             expect(passage.connection).to.be.a(WebSocket);
//         });
//         it('should have event emitter', () => {
//             const name = 'my.event';
//             const handler = () => {};
//             passage.on(name, handler);
//             expect(passage.listenerCount(name)).to.equal(1);
//             expect(passage.listeners(name)[0]).to.equal(handler);
//             passage.removeListener(name, handler);
//             expect(passage.listenerCount(name)).to.equal(0);
//         });
//     });
// });
