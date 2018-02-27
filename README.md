# Passage RPC

#### Client and server side JSON-RPC 2.0 websockets library

This is a websocket subprotocol implementation for remote procedure calls supporting server response.

http://www.jsonrpc.org/specification

## Installation from NPM

Install the package from npm.

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

## Installation from IIFE

Download and include the library onto your page from this repositories' `/dist` directory.

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

passage.send('myapp.hello', { user: 'mike' }, (error, result) => {
    console.log(result);
});
```

## Options

#### requestTimeout <default: 6000>

The amount of time the server can take responding to requests.

#### reconnect <default: false>

Whether the client should attempt to reconnect when disconnected.

#### reconnectTimeout <default: 2000>

The amount of time to wait before attempting to reconnect.

#### reconnectTries <default: 60>

The maximum number of tries when attempting to reconnect.

## Events

When the server sends a notification to your application, you may choose to set an event for that data using `on(methodName, callback)`. There are a few included events the client library provides.

| method | description |
| - | - |
| `rpc.open` | Connection established. |
| `rpc.close` | Connection closed. |
| `rpc.error` | Error has occurred. |
| `rpc.message` | Message was received. |

## Instance

#### close () => void

Closes the connection.

#### connect () => void

This will close the connection, then reconnect.

#### send (method: string, [params: any], callback?: (error: Error, result?: any) => void, timeout?: number) => void

Send a request to the server. If a callback is provided, then the server will respond once it has finished processing the request. It may return an error or a result once completed but not both. If a timeout is provided it will override the default request timeout from options.

## Hacking

If sending one message at a time isn't enough, JSON-RPC supports sending an array of messages. To do this the library exposes a few helper methods for you to use. A full example sending multiple messages can be seen below.

```javascript
const passage = new Passage('wss://example.com');

passage.on('rpc.open', () => {
    const callback = (error, result) => {
        console.log(result);
    };
    const messages = [
        passage.buildMessage('myapp.notify', { code: 'the stork swims at midnight' }),
        passage.buildMessage('myapp.respond', 'some text', callback)
    ];
    passage.connection.send(JSON.stringify(messages));
});
```

#### buildMessage (method: string, [params: any], callback?: (error: Error, result?: any) => void, timeout?: number) => void

Creates a simple object for consumption by the server. It takes the same values as the `send` method, however does not stringify or send the message. If a callback is provided it will timeout after this method is called, you should expect to send your payload soon.

#### expectResponse (callback: (error: Error, result?: any) => void, timeout?: number) => number

Returns a number representing a message id. The callback will timeout if a response containing the message id is not received in time. You may only need to use this if you are building a message object completely by hand.

## Server usage

```javascript
const options = {
    port: 8000,
    methods: {
        'myapp.sayHello': () => 'hi';
    }
};

const wss = new Passage.Server(options, () => {
    console.log('Listening on port: 8080');
});

wss.on('rpc.connection', (ws) => {
    ws.notify('myapp.fromSpace', 'rocket man');
});
```
