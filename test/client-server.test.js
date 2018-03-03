const expect = require('expect.js');
const WebSocket = require('ws');
const PassageServer = require('../src/server');
const PassageClient = require('../src/client')(WebSocket);

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
    it('client should send a request', done => {
        const method = 'myapp.request';
        const methods = { [method]: (received) => {
            expect(received).to.be(undefined);
            done();
        } };
        buildServer(methods, () => {
            client.on('rpc.open', () => {
                client.send(method);
            });
        });
    });
    it('client should send a request with params', done => {
        const method = 'myapp.request';
        const params = { hi: 'there' };
        const methods = { [method]: (received) => {
            expect(received).to.eql(params);
            done();
        } };
        buildServer(methods, () => {
            client.on('rpc.open', () => {
                client.send(method, params);
            });
        });
    });
    it('client should send multiple requests with params', done => {
        const method1 = 'myapp.request';
        const method2 = 'myapp.alert';
        const params1 = { test: 'data' };
        let count1 = 0;
        let count2 = 0;
        const methods = {
            [method1]: () => { count1++; return params1; },
            [method2]: () => { count2++; }
        };
        const callback = (error, response) => {
            expect(error).to.be(undefined);
            expect(response).to.eql(params1);
            expect(count1).to.equal(2);
            expect(count2).to.equal(1);
            done();
        };
        buildServer(methods, () => {
            client.on('rpc.open', () => {
                const messages = [
                    client.buildMessage(method1, callback),
                    client.buildMessage(method1, { code: 'the stork swims at midnight' }),
                    client.buildMessage(method2, 'important message')
                ];
                const payload = JSON.stringify(messages);
                client.connection.send(payload);
            });
        });
    });
    it('server should send a notification', done => {
        const method = 'myapp.notification';
        buildServer(() => {
            client.on(method, (received) => {
                expect(received).to.be(undefined);
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
            client.on(method, (received) => {
                expect(received).to.eql(params);
                done();
            });
            server.on('rpc.connection', (ws) => {
                ws.send(method, params);
            });
        });
    });
    it('server should send multiple notifications with params', done => {
        const method1 = 'myapp.notify';
        const method2 = 'myapp.alert';
        const params2 = { a: 'message' };
        let count1 = 0;
        let count2 = 0;
        buildServer(() => {
            client.on(method1, (received) => {
                count1++;
                expect(received).to.be(undefined);
                if (count1 === 2 && count2 === 1) done();
            });
            client.on(method2, (received) => {
                count2++;
                expect(received).to.eql(params2);
                if (count1 === 2 && count2 === 1) done();
            });
            server.on('rpc.connection', (ws) => {
                const messages = [
                    ws.buildMessage(method1),
                    ws.buildMessage(method2, params2),
                    ws.buildMessage(method1)
                ];
                const payload = JSON.stringify(messages);
                ws.connection.send(payload);
            });
        });
    });
    it('server should respond to a request', done => {
        const method = 'myapp.request';
        const methods = { [method]: () => {} };
        buildServer(methods, () => {
            client.on('rpc.open', () => {
                client.send(method, (error, response) => {
                    expect(error).to.be(undefined);
                    expect(response).to.be(undefined);
                    done();
                });
            });
        });
    });
    it('server should respond to a request with params', done => {
        const method = 'myapp.request';
        const params = { some: 'data' };
        const response = { a: 'response' };
        const methods = { [method]: (received, ws) => {
            expect(received).to.eql(params);
            expect(ws.connection).to.be.a(WebSocket);
            return response;
        } };
        buildServer(methods, () => {
            client.on('rpc.open', () => {
                client.send(method, params, (error, response) => {
                    expect(error).to.be(undefined);
                    expect(response).to.eql(response);
                    done();
                });
            });
        });
    });
});
