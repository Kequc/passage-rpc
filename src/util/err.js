const err = {};

err.build = (params) => {
    const error = new Error(params.message);
    error.name = params.name,
    error.code = params.code,
    error.data = params.data;
    return error;
};

err.toJSON = (error) => ({
    message: error.message,
    name: error.name,
    code: error.code,
    data: error.data
});

// Timeout
err.timeout = (data) =>
    err.build({ code: 408, name: 'Timeout', message: 'Timeout', data });

// Service unavailable
err.serviceUnavailable = (data) =>
    err.build({ code: 503, name: 'ServiceUnavailable', message: 'Service unavailable', data });

// Invalid JSON was received by the server.
err.parseError = (data) =>
    err.build({ code: -32700, name: 'ParseError', message: 'Parse error', data });

// The JSON sent is not a valid Request object.
err.invalidRequest = (data) =>
    err.build({ code: -32600, name: 'InvalidRequest', message: 'Invalid request', data });

// The method does not exist.
err.methodNotFound = (data) =>
    err.build({ code: -32601, name: 'MethodNotFound', message: 'Method not found', data });

// Invalid method parameter(s).
err.invalidParams = (data) =>
    err.build({ code: -32602, name: 'InvalidParams', message: 'Invalid params', data });

// Internal JSON-RPC error.
err.internalError = (data) =>
    err.build({ code: -32603, name: 'InternalError', message: 'Internal error', data });

module.exports = err;
