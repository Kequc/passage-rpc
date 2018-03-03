const err = require('./err');

function getId (request) {
    if (typeof request !== 'object') return null;
    if (typeof request.id !== 'number' && typeof request.id !== 'string') return null;
    return request.id;
}

class Parser {
    constructor (data) {
        try {
            this.parsed = JSON.parse(data);
        } catch (e) {
            // invalid json
        }
    }

    error () {
        if (!this.parsed) return err.parseError();
        if (this.parsed.length < 1) return err.invalidRequest();
    }

    get isArray () {
        return Array.isArray(this.parsed);
    }

    get requests () {
        return (this.isArray ? this.parsed : [this.parsed]);
    }

    get ids () {
        return this.requests.map(getId);
    }
}

module.exports = Parser;
