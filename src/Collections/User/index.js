// @flow


const Collection = require('paperframe/lib/Collection');

const drivers = {
    'cql': require('./Cql')
};

module.exports = class User extends Collection.auto('user', drivers) {
    async canLogInWith(username: string, password: string): Promise<boolean> {
        const user = await this.driver.getUser(username);

        console.log(user);

        return true;
    }
};
