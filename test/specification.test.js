const expect = require('expect.js');
const WebSocket = require('ws');
const PassageServer = require('../src/server');
const jsonrpc = require('../src/version');

const PORT = 9000;
const URI = `ws://localhost:${PORT}`;

describe('specification', () => {
    let server;
    let client;

    function buildServer (methods, ready) {
        server = new PassageServer({ port: PORT, methods }, () => {
            client = new WebSocket(URI);
            client.on('error', () => {}); // must define error handler
            client.on('open', ready);
        });
    }

    function buildExpected (messages) {
        if (Array.isArray(messages)) {
            return messages.map(message => (Object.assign({ jsonrpc, id: null }, message)));
        } else {
            return Object.assign({ jsonrpc, id: null }, messages);
        }
    }

    function testRpc (methods, payload, response, done) {
        buildServer(methods, () => {
            client.on('message', (data) => {
                expect(JSON.parse(data)).to.eql(buildExpected(response));
                done();
            });
            client.send(payload);
        });
    }

    afterEach(done => {
        server.close(done);
        server = undefined;
        client = undefined;
    });

    it('rpc call with positional parameters 1', done => {
        const subtract = arr => arr[0] - arr[1];
        const payload = '{"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1}';

        testRpc({ subtract }, payload, { result: 19, id: 1 }, done);
    });
    it('rpc call with positional parameters 2', done => {
        const subtract = arr => arr[0] - arr[1];
        const payload = '{"jsonrpc": "2.0", "method": "subtract", "params": [23, 42], "id": 2}';

        testRpc({ subtract }, payload, { result: -19, id: 2 }, done);
    });
    it('rpc call with named parameters 1', done => {
        const subtract = params => params.minuend - params.subtrahend;
        const payload = '{"jsonrpc": "2.0", "method": "subtract", "params": {"subtrahend": 23, "minuend": 42}, "id": 3}';

        testRpc({ subtract }, payload, { result: 19, id: 3 }, done);
    });
    it('rpc call with named parameters 2', done => {
        const subtract = params => params.minuend - params.subtrahend;
        const payload = '{"jsonrpc": "2.0", "method": "subtract", "params": {"minuend": 42, "subtrahend": 23}, "id": 4}';

        testRpc({ subtract }, payload, { result: 19, id: 4 }, done);
    });
    it('a Notification 1', done => {
        const update = params => {
            expect(params).to.eql([1,2,3,4,5]);
            done();
        };
        buildServer({ update }, () => {
            const payload = '{"jsonrpc": "2.0", "method": "update", "params": [1,2,3,4,5]}';
            client.send(payload);
        });
    });
    it('a Notification 2', done => {
        const foobar = params => {
            expect(params).to.be(undefined);
            done();
        };
        buildServer({ foobar }, () => {
            const payload = '{"jsonrpc": "2.0", "method": "foobar"}';
            client.send(payload);
        });
    });
    it('rpc call of non-existent method', done => {
        const payload = '{"jsonrpc": "2.0", "method": "foobar", "id": "1"}';

        testRpc({}, payload, { error: { code: -32601, name: 'MethodNotFound', message: 'Method not found' }, id: '1' }, done);
    });
    it('rpc call with invalid JSON', done => {
        const payload = '{"jsonrpc": "2.0", "method": "foobar, "params": "bar", "baz]';

        testRpc({}, payload, { error: { code: -32700, name: 'ParseError', message: 'Parse error' }, id: null }, done);
    });
    it('rpc call with invalid Request object', done => {
        const payload = '{"jsonrpc": "2.0", "method": 1, "params": "bar"}';

        testRpc({}, payload, { error: { code: -32600, name: 'InvalidRequest', message: 'Invalid request' }, id: null }, done);
    });
    it('rpc call Batch, invalid JSON', done => {
        const payload = `[
    {"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"},
    {"jsonrpc": "2.0", "method"
]`;

        testRpc({}, payload, { error: { code: -32700, name: 'ParseError', message: 'Parse error'}, id: null }, done);
    });
    it('rpc call with an empty Array', done => {
        const payload = '[]';

        testRpc({}, payload, { error: { code: -32600, name: 'InvalidRequest', message: 'Invalid request'}, id: null }, done);
    });
    it('rpc call with an invalid Batch (but not empty)', done => {
        const payload = '[1]';

        testRpc({}, payload, [{ error: { code: -32600, name: 'InvalidRequest', message: 'Invalid request' }, id: null }], done);
    });
    it('rpc call with invalid Batch', done => {
        const payload = '[1,2,3]';
        const expected = [
            { error: { code: -32600, name: 'InvalidRequest', message: 'Invalid request' }, id: null },
            { error: { code: -32600, name: 'InvalidRequest', message: 'Invalid request' }, id: null },
            { error: { code: -32600, name: 'InvalidRequest', message: 'Invalid request' }, id: null }
        ];

        testRpc({}, payload, expected, done);
    });
    it('rpc call Batch', done => {
        const methods = {
            sum: (params) => params[0] + params[1] + params[2],
            notify_hello: () => {},
            subtract: (params) => params[0] - params[1],
            get_data: () => ['hello', 5]
        };
        const payload = `[
    {"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"},
    {"jsonrpc": "2.0", "method": "notify_hello", "params": [7]},
    {"jsonrpc": "2.0", "method": "subtract", "params": [42,23], "id": "2"},
    {"foo": "boo"},
    {"jsonrpc": "2.0", "method": "foo.get", "params": {"name": "myself"}, "id": "5"},
    {"jsonrpc": "2.0", "method": "get_data", "id": "9"} 
]`;
        const expected = [
            { result: 7, id: '1' },
            { result: 19, id: '2' },
            { error: { code: -32600, name: 'InvalidRequest', message: 'Invalid request' }, id: null },
            { error: { code: -32601, name: 'MethodNotFound', message: 'Method not found' }, id: '5' },
            { result: ['hello', 5], id: '9' }
        ];

        testRpc(methods, payload, expected, done);
    });
    it('rpc call Batch (all notifications)', done => {
        let count1 = 0;
        let count2 = 0;
        const methods = {
            notify_sum: (params) => {
                count1++;
                expect(params).to.eql([1,2,4]);
                if (count1 === 1 && count2 == 1) done();
            },
            notify_hello: (params) => {
                count2++;
                expect(params).to.eql([7]);
                if (count1 === 1 && count2 == 1) done();
            }
        };
        const payload = `[
    {"jsonrpc": "2.0", "method": "notify_sum", "params": [1,2,4]},
    {"jsonrpc": "2.0", "method": "notify_hello", "params": [7]}
]`;
        buildServer(methods, () => {
            client.send(payload);
        });
    });
});
