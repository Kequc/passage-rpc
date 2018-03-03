const err = require('./err');
const Parser = require('./parser');
const jsonrpc = require('../version');

const getPromise = (methods, client) => request => {
    if (typeof request !== 'object')
        return Promise.resolve(err.invalidRequest());
    if (typeof request.method !== 'string' || request.jsonrpc !== jsonrpc)
        return Promise.resolve(err.invalidRequest());
    if (methods[request.method] === undefined)
        return Promise.resolve(err.methodNotFound());

    const result = methods[request.method](request.params, client);
    return Promise.resolve(result).catch(e => e);
};

function buildResponse (data, methods, client) {
    const parser = new Parser(data);

    const error = parser.error();
    if (error)
        return Promise.resolve({ jsonrpc, error: err.toJSON(error), id: null });

    const promises = parser.requests.map(getPromise(methods, client));
    const ids = parser.ids;

    return Promise.all(promises).then((results) => {
        const response = [];

        for (let i = 0; i < ids.length; i++) {
            const result = results[i];
            if (result instanceof Error) {
                response.push({ jsonrpc, error: err.toJSON(result), id: ids[i] });
            } else if (ids[i] !== null) {
                response.push({ jsonrpc, result, id: ids[i] });
            }
        }

        if (response.length < 1) return undefined;
        if (!parser.isArray) return response[0];

        return response;
    });
}

module.exports = buildResponse;
