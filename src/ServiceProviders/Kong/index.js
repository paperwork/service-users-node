//@flow

const axios = require('axios');
const HttpStatus = require('http-status-codes');

const ServiceProvider = require('paperframe').ServiceProvider;
const PaperframeCommon = require('paperframe').Common;

module.exports = class KongServiceProvider extends ServiceProvider {
    _kongApiUrl:                string
    _guestId:                   string

    initialize(): boolean {
        // Kong API URL
        this._kongApiUrl = this.getEnv('KONG_API_URL');
        if(typeof this._kongApiUrl === 'undefined') {
            this.logger.error('KongServiceProvider: Could not initialize, KONG_API_URL not set!');
            return false;
        }

        this.logger.debug('KongServiceProvider: Initialized with KONG_API_URL set to %s.', this._kongApiUrl);

        this.migrate();

        return true;
    }

    async migrate(): Promise<boolean> {
        let response = {};

        response = await this.execute('post', `${this._kongApiUrl}/consumers`, {
            'custom_id': '00000000-0000-0000-0000-000000000000',
            'username': '00000000-0000-0000-0000-000000000000'
        });

        if(response === {}) {
            response = await this.execute('get', `${this._kongApiUrl}/consumers/00000000-0000-0000-0000-000000000000`);
            this._guestId = response.id;
        } else {
            this._guestId = response.id;
        }

        return true;
    }

    async execute(method: string, url: string, payload: ?Object): Promise<Object> {
        let responseCode = -1;
        let responseData = {};

        this.logger.debug(`Kong: Executing ${method} on ${url}...`);

        try {
            const response = await axios[method](url, payload);

            responseCode = response.status;
            responseData =  response.data;

            this.logger.debug(`Kong: Executed ${method} on ${url} successfully.`);
        } catch(response) {
            if(response.hasOwnProperty('response') === true
            && typeof response.response !== 'undefined') {
                responseCode = response.response.status;
                responseData = response.response;
            } else {
                responseData = response;
            }

            this.logger.debug(`Kong: Execution of ${method} on ${url} returned response code ${responseCode}.`);
        }

        if(responseCode !== HttpStatus.OK
        && responseCode !== HttpStatus.CREATED
        && responseCode !== HttpStatus.CONFLICT) {
            console.error(responseData);
            throw new Error(`Kong: ${responseCode}`);
        }

        return responseData;
    }

    async createApi(methods: Array<string>|string, prefix: string, resource: string, uris: Array<string>|string, isProtected: boolean): Promise<boolean> {
        const apiName = `${this.getEnv('SERVER_NAME')}_${prefix}_${resource}`;

        let response = await this.execute('post', `${this._kongApiUrl}/apis`, {
            'methods': methods,
            'uris': uris,
            'strip_uri': false,
            'name': apiName,
            'upstream_url': `${this.getEnv('SERVICE_USERS_URL')}`
        });

        if(isProtected === true) {
            response = await this.execute('post', `${this._kongApiUrl}/apis/${apiName}/plugins`, {
                'name': 'jwt',
                'config.anonymous': this._guestId,
                'config.claims_to_verify': [
                    'exp'
                    // 'nbf' // Not in use yet
                ]
            });
        }

        return true;
    }
};
