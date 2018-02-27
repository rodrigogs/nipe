const bluebird = require('bluebird');

global.Promise = bluebird;

module.exports = Promise;
