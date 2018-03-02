module.exports = (data) => {
    const error = new Error('Timeout');
    error.name = 'Timeout';
    error.code = 408;
    error.data = data;
    return error;
};
