//@flow

const PaperworkCollection = require('paperwork-sdk-service-node/lib/PaperworkCollection');
const Common = require('paperframe/lib/Common');

module.exports = class UserCql extends PaperworkCollection {
    async getUser(username: string): Promise<?Object> {
        const query = 'SELECT * FROM users WHERE username = ?';
        const result: Object = await this.dbc.execute(query, [username]);

        if(result.hasOwnProperty('rows')
        && Array.isArray(result.rows)
        && result.rows === Common.ONE) {
            return result.rows[Common.FIRST];
        }

        return null;
    }
};
