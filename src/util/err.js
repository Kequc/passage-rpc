function build (params) {
    const error = new Error(params.message);
    error.name = params.name,
    error.code = params.code,
    error.data = params.data;
    return error;
}

module.exports.toJSON = (err) => ({
    message: err.message,
    name: err.name,
    code: err.code,
    data: err.data
});

// Timeout
module.exports.timeout = (data) =>
    build({ code: 408, name: 'Timeout', message: 'Timeout', data });

// Service unavailable
module.exports.serviceUnavailable = (data) =>
    build({ code: 503, name: 'ServiceUnavailable', message: 'Service unavailable', data });

// Invalid JSON was received by the server.
module.exports.parseError = (data) =>
    build({ code: -32700, name: 'ParseError', message: 'Parse error', data });

// The JSON sent is not a valid Request object.
module.exports.invalidRequest = (data) =>
    build({ code: -32600, name: 'InvalidRequest', message: 'Invalid request', data });

// The method does not exist.
module.exports.methodNotFound = (data) =>
    build({ code: -32601, name: 'MethodNotFound', message: 'Method not found', data });

// Invalid method parameter(s).
module.exports.invalidParams = (data) =>
    build({ code: -32602, name: 'InvalidParams', message: 'Invalid params', data });

// Internal JSON-RPC error.
module.exports.internalError = (data) =>
    build({ code: -32603, name: 'InternalError', message: 'Internal error', data });
