module.exports = (data) => {
    const error = new Error('Service unavailable');
    error.name = 'ServiceUnavailable';
    error.code = 503;
    error.data = data;
    return error;
};
