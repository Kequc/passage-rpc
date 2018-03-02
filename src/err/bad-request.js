module.exports = (data) => {
    const error = new Error('Bad request');
    error.name = 'BadRequest';
    error.code = 400;
    error.data = data;
    return error;
};
