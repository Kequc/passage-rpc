const wss = new WebSocket.Server({ port });

// communication

function sendObj(obj) {
    console.log('out:');
    console.log(obj);
    this.send(JSON.stringify(obj));
}

const sendResult = (ws, id) => (result = {}) => {
    if (!id) return;
    ws.sendObj({ id, result });
};

const sendError = (ws, id) => (error) => {
    console.error(error);
    if (!id) return;
    ws.sendObj({
        id,
        error: {
            name: error.name,
            message: error.message,
            app: true
        }
    });
};

// primary

function onPong() {
    this.isAlive = true;
}

function onMessage(message) {
    const parsed = parseTransaction(message);
    console.log('in:');
    console.log(parsed);
    const method = METHODS[parsed.method];
    if (method) {
        method(parsed.params, this)
            .then(sendResult(this, parsed.id))
            .catch(sendError(this, parsed.id));
    } else {
        const error = new ERR.BadRequest(`Invalid remote method "${parsed.method}"`);
        sendError(this, parsed.id)(error);
    }
}

function onClose() {
    console.log('ws close!');
    tracker.remove(this);
}

function onError(err) {
    console.log('ws error:');
    console.log(err);
}

wss.on('connection', (ws) => {
    console.log('ws connection!');
    ws.isAlive = true;
    ws.sendObj = sendObj;
    ws.sess = new Sess();
    ws.on('pong', onPong);
    ws.on('message', onMessage);
    ws.on('close', onClose);
    ws.on('error', onError);
});

// do not resuscitate

const HEARTRATE = 30000;

setInterval(() => {
    for (const client of wss.clients) {
        if (client.isAlive) {
            client.isAlive = false;
            client.ping('', false, true);
        } else {
            client.terminate();
        }
    }
}, HEARTRATE);
