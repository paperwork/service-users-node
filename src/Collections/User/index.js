// @flow


const Collection = require('paperframe/lib/Collection');

const drivers = {
    'cql': require('./Cql')
};

module.exports = class User extends Collection.auto('user', drivers) {
};
