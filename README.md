# Passage RPC

#### Client and server side JSON-RPC 2.0 websockets

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

## Setup

Create a new instance of `Passage` providing a uri and set of options.

```javascript
const options = {
    requestTimeout: 6000,
    reconnect: false,
    reconnectTimeout: 2000,
    reconnectTries: 60
};

const passage = new Passage('wss://example.com', options);

passage.on('rpc.open', () => {
    console.log('connected!');
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

When the server sends a notification to your application, it triggers an event. This library uses node's [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter) therefore events can be listened for in a common way.

| method | description | params |
| - | - | - |
| `rpc.message` | Message was received. | data |
| `rpc.open` | Connection established. | |
| `rpc.close` | Connection closed. | reconnecting |
| `rpc.error` | Error has occurred. | Error |

```javascript
passage.on('myapp.welcome', (params) => {
    console.log(params);
});
```

On `rpc.close` a parameter is passed representing whether the module intends to reconnect. This will only be true if the `reconnect` option has been set to true, and the maximum number of `reconnectTries` has not been met.

## Instance

#### close (code?: number, reason?: string) => void

Closes the connection using the optional code and reason given.

#### connect () => void

This will close the connection, then reconnect.

#### readyState

The ready state of the connection, useful to compare against named ready states available on the constructor.

| name | value | location |
| - | - | - |
| CONNECTING | 0 | `Passage.CONNECTING` |
| OPEN | 1 | `Passage.OPEN` |
| CLOSING | 2 | `Passage.CLOSING` |
| CLOSED | 3 | `Passage.CLOSED` |

```javascript
if (passage.readyState !== Passage.OPEN) {
    console.log('Not connected');
}
```

#### send (method: string, [params: any], callback?: (error: Error, result?: any) => void, timeout?: number) => void

If a callback is provided, then the server will respond once it has finished processing. It may return an error or a result once completed but not both. Params will be available for consumption on the server. If a timeout  is provided it will override the default `requestTimeout` from options.

```javascript
passage.send('myapp.hello');

passage.send('myapp.hello', (error, response) => {
    if (error) throw error;
    console.log(response);
});

passage.send('myapp.hello', { my: 'params' });

passage.send('myapp.hello', { my: 'params' }, (error, response) => {
    if (error) throw error;
    console.log(response);
});
```

Note: If a callback is not provided and the connection is not available this method will throw an error.

## Sending more than one request at the same time

JSON-RPC supports sending an array of messages. To do this the library exposes helper methods for you to use. A full example sending multiple messages can be seen below.

```javascript
const callback = (error, response) => {
    console.log(response);
};

const messages = [
    passage.buildMessage('myapp.request', callback),
    passage.buildMessage('myapp.request', { code: 'the stork swims at midnight' }),
    passage.buildMessage('myapp.alert', 'important message')
];

const payload = JSON.stringify(messages);
passage.connection.send(payload);
```

#### buildMessage (method: string, [params: any], callback?: (error: Error, result?: any) => void, timeout?: number) => Object

This creates a simple object for consumption by the server. It takes the same values as the `send` method, however does not stringify or send the message. If a callback is provided it will timeout, if you use this function you should send your payload soon.

#### expectResponse (callback: (error: Error, result?: any) => void, timeout?: number) => number

Returns a number representing a message id. The callback will timeout if a response containing the message id is not received in time.

## Server setup

The server implementation is built on the [npm ws](https://github.com/websockets/ws) library and shares several similarities with it. There are a few additional options and events utilised for JSON-RPC.

```javascript
const Passage = require('passage-rpc');

const port = 8000;
const heartrate = 30000;
const methods = {
    'myapp.hello': () => 'hi';
};

const server = new Passage.Server({ port, heartrate, methods });

server.on('rpc.connection', (client) => {
    console.log('connected!');
    client.send('myapp.welcome', { hi: 'there' });
});

server.on('rpc.listening', () => {
    console.log('Listening on port: ' + port);
});
```

#### heartrate <default: 30000>

Periodically each of the connected clients will be pinged terminating ones for which there is no response. Checking every 30 seconds is a good default but you might wish to adjust this.

#### methods <default: {}>

The methods parameter is a dictionary of procedures your server listens to from the client. In this case if a client sends `myapp.hello` the server will run the associated function and respond with `"hi"`. You may return an `Error` instead, or even nothing at all.

Whether the server responds is dependent on the client. If the client is not waiting for a response the server will not send one. Every method is expected to be in the following format.

`(params: any, client: ConnectedClient) => any`

Must return a `Promise` if you are doing something which is asyncronous.

For example:

```javascript
const methods = {
    'myapp.findUser': async (userId) => {
        const user = await findUser(userId);
        return user;
    }
};
```

## Server events

Events on the server are handled differently than on the client in most cases, but there are important ones.

| method | description | params |
| - | - | - |
| `rpc.listening` | Server is listening. | |
| `rpc.connection` | Connection established. | ConnectedClient, req object |
| `rpc.error` | Error has occurred. | Error |

## Server instance

#### close (callback?: () => void) => void

Closes the server then runs the callback.

#### clients

Set of connected clients.

## ConnectedClient instance

The `rpc.connection` event offers a connected client instance, and a `req` object. The connected client has its own events separate from the server.

| method | description | params |
| - | - | - |
| `rpc.message` | Message was received. | data |
| `rpc.close` | Connection closed. | |
| `rpc.error` | Error has occurred. | Error |

#### close (code?: number, reason?: string) => void

Closes the connection using the optional code and reason given.

#### readyState

The ready state of the connection.

#### send (method: string, [params: any], callback?: (error: Error) => void) => void

Send a notification to the connected client.

```javascript
client.send('myapp.welcome');

client.send('myapp.welcome', { my: 'params' });

client.send('myapp.welcome', (error) => {
    if (!error) console.log('Notification sent');
});

client.send('myapp.welcome', { my: 'params' }, (error) => {
    if (!error) console.log('Notification sent');
});
```

Note: If a callback is not provided and the connection is not available this method will throw an error.

## Sending more than one notification at the same time

This again must be done manually, a full example from the server can be seen below.

```javascript
const messages = [
    client.buildMessage('myapp.notify'),
    client.buildMessage('myapp.notify', { friends: 'forevah' }),
    client.buildMessage('myapp.alert'),
];

const payload = JSON.stringify(messages);
client.connection.send(payload, (error) => {
    if (!error) console.log('Notifications sent');
});
```

#### buildMessage (method: string, params?: any) => Object

This creates a simple object for consumption by the client. It takes nearly the same values as the `send` method, however does not stringify or send the message and does not take a callback.

## Errors

When returning an `Error` from the server, it should be a real `Error` instance, the following attributes will be transmitted across the network, `message` `name` `code` `data`. The data attribute contains any additional information you would like but it must be stringifiable into JSON.

There are some errors the library may return itself.

| name | code | message |
| - | - | - |
| `Timeout` | 408 | Timeout |
| `ServiceUnavailable` | 503 | Service unavailable |
| `ParseError` | -32700 | Parse error |
| `InvalidRequest` | -32600 | Invalid request |
| `MethodNotFound` | -32601 | Method not found |

## Example

Server

```javascript
const Passage = require('passage-rpc');

const port = 8080;
const methods = {
    'myapp.cats.list': async () => {
        const cats = await getCats();
        return { cats };
    }
};

const server = new Passage.Server({ port, methods });

server.on('rpc.listening', () => {
    console.log('Server listening on port: ' + port);
});

server.on('rpc.connection', (client) => {
    setTimeout(() => {
        client.send('myapp.hi', { message: 'Connected 10 seconds ago.' });
    }, 10000);
});
```

Client

```javascript
const Passage = require('passage-rpc');

const passage = new Passage('ws://localhost:8080');

function processResponse (error, response) {
    if (error) throw error;
    console.log(`Returned ${response.cats.length} cat(s).`);
}

passage.on('myapp.hi', (params) => {
    console.log(params.message);
    passage.send('myapp.cats.list', processResponse);
});
```
