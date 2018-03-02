# Passage RPC

#### Client and server side JSON-RPC 2.0 websockets library

This is a websocket subprotocol implementation designed for remote procedure calls and server responses.

http://www.jsonrpc.org/specification

## Installation from NPM

Install the package.

```text
npm i passage-rpc --save
```

Import it into your server side script.

```javascript
const Passage = require('passage-rpc');
```

Import it into your client side script.

```javascript
import Passage from 'passage-rpc';
```

## Installation using IIFE

Download and include the library onto your page, a minified version can be found in the `/dist` directory.

```html
<script src="/javascripts/passage-rpc.min.js"></script>
```

## Client usage

Create a new instance of `Passage` providing a uri and set of options.

```javascript
const passage = new Passage('wss://example.com', {
    requestTimeout: 6000,
    reconnect: false,
    reconnectTimeout: 2000,
    reconnectTries: 60
});

passage.on('rpc.open', () => {
    console.log('connected!');
});

passage.on('myapp.newuser', (params) => {
    console.log(params);
});

passage.send('myapp.hello', (error, result) => {
    console.log(result);
});
```

## Options

#### requestTimeout <default: 6000>

The amount of time the server can take responding to requests before a timeout.

#### reconnect <default: false>

Whether the client should attempt to reconnect when disconnected.

#### reconnectTimeout <default: 2000>

The amount of time to wait between reconnection attempts.

#### reconnectTries <default: 60>

Maximum number of reconnection attempts.

## Events

When the server sends a notification to your application, it triggers an event. You may choose to set a listener using `.on(method, callback)`. There are a few included events the client library provides.

| method | description |
| - | - |
| `rpc.message` | Message was received. |
| `rpc.open` | Connection established. |
| `rpc.close` | Connection closed. |
| `rpc.error` | Error has occurred. |

## Instance

#### close () => void

Closes the connection.

#### connect () => void

This will close the connection, then reconnect.

#### send (method: string, [params: any], callback?: (error: Error, result?: any) => void, timeout?: number) => void

Send a request to the server. If a callback is provided, then the server will respond once it has finished processing. It may return an error or a result once completed but not both. Params will be available for consumption on the server. If a timeout  is provided it will override the default `requestTimeout` from options.

## Sending more than one message at the same time

JSON-RPC supports sending an array of messages. To do this the library exposes helper methods for you to use. A full example sending multiple messages can be seen below.

```javascript
const passage = new Passage('wss://example.com');

passage.on('rpc.open', () => {
    const callback = (error, result) => {
        console.log(result);
    };
    const messages = [
        passage.buildMessage('myapp.notify', callback),
        passage.buildMessage('myapp.notify', { code: 'the stork swims at midnight' }),
        passage.buildMessage('myapp.alert', 'important message')
    ];
    const payload = JSON.stringify(messages);
    passage.connection.send(payload);
});
```

#### buildMessage (method: string, [params: any], callback?: (error: Error, result?: any) => void, timeout?: number) => Object

This creates a simple object for consumption by the server. It takes the same values as the `send` method, however does not stringify or send the message. If a callback is provided it will timeout, if you use this function you should send your payload soon.

#### expectResponse (callback: (error: Error, result?: any) => void, timeout?: number) => number

Returns a number representing a message id. The callback will timeout if a response containing the message id is not received in time. You may only need to use this if you need to have full control over message parameters.

## Server usage

The server implementation is built on the [npm ws](https://github.com/websockets/ws) library and shares several similarities. There are a few additional options and events utilised for JSON-RPC.

```javascript
const options = {
    port: 8000,
    heartrate: 30000,
    methods: {
        'myapp.hello': () => 'hi';
    }
};

const wss = new Passage.Server(options, () => {
    console.log('Listening on port: ' + options.port);
});

wss.on('rpc.connection', () => {
    console.log('client connected!');
});
```

The second parameter is a callback which runs when the server is listening for requests. It is an alias for the `rpc.listening` event which you will learn about below.

#### heartrate <default: 30000>

The server will periodically ping each of the connected clients and terminate ones which do not respond in time. Checking every 30 seconds is a good default but you might wish to adjust this.

#### methods <default: {}>

The methods parameter is a dictionary of methods your server listens to from the client. In this case if a client sends `myapp.hello` the server will run the associated function and respond with `"hi"`.

You may return an `Error` instead, or even nothing at all. Whether the server responds to a request is dependent on the client. If the client is not waiting for a response the server will not send one.

Every method when called is provided with parameters from the client, as well as the connection, in the following format.

`(params: any, ws: WebSocket) => any`

You must return a `Promise` if you are doing something that is asyncronous.

For example:

```javascript
const methods = {
    'myapp.findUser': async (userId) => {
        const user = await findUser(userId);
        return user;
    }
};
```

## Events

Like the client, the server also provides several events.

| method | description |
| - | - |
| `rpc.listening` | Server is listening. |
| `rpc.connection` | Connection established. |
| `rpc.error` | Error has occurred. |

The `rpc.connection` event delivers the connected `WebSocket` instance, and a `req` object. The connected `WebSocket` instance also provides events.

| method | description |
| - | - |
| `rpc.message` | Message was received. |
| `rpc.close` | Connection closed. |
| `rpc.error` | Error has occurred. |

## Instance

#### ws.notify(method: string, params?: any) => void

Send a notification to the connected client.

## Sending more than one notification at the same time

Sending multiple messages at once must be done manually. A full example can be seen below.

```javascript
const wss = new Passage.Server();

wss.on('rpc.connection', (ws) => {
    const messages = [
        ws.buildMessage('myapp.notify'),
        ws.buildMessage('myapp.notify', { a: 'message' }),
    ];
    const payload = JSON.stringify(messages);
    ws.send(payload);
});
```

#### buildMessage (method: string, [params: any]) => Object

This creates a simple object for consumption by the client. It takes the same values as the `notify` method, however does not stringify or send the message.

You then use this in conjunction with the raw `send` method, to deliver the messages.
