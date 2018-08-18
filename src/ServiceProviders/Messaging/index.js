//@flow

const NATS = require('nats');
const HttpStatus = require('http-status-codes');

const ServiceProvider = require('paperframe').ServiceProvider;
const PaperframeCommon = require('paperframe').Common;

import type {
    TEventPackage
} from 'paperframe/lib/Event';

module.exports = class MessagingServiceProvider extends ServiceProvider {
    _natsConnection:            string
    _nats:                      ?NATS

    async initialize(): Promise<boolean> {
        this._natsConnection = this.getEnv('NATS_CONNECTION');
        if(typeof this._natsConnection === 'undefined') {
            this.logger.error('MessagingServiceProvider: Could not initialize, NATS_CONNECTION not set!');
            this.logger.warn('MessagingServiceProvider: Running without MessagingServiceProvider.');
            this._nats = null;
        } else {
            this._nats = NATS.connect(this._natsConnection, this._serverName);

            return new Promise((fulfill, reject) => {
                if(typeof this._nats === 'undefined'
                || this._nats === null) {
                    return fulfill(false);
                }

                return this._nats.on('connect', () => {
                    if(typeof this._nats === 'undefined'
                    || this._nats === null) {
                        this.logger.debug('MessagingServiceProvider: Could not initialize with NATS_CONNECTION set to %s.', this._natsConnection);
                        return fulfill(false);
                    }

                    let eventsSubscription = this._nats.subscribe('*', async (message: Object, reply: Object, subject: string) => {
                        this._processMessage(message, reply, subject);
                    });

                    this.logger.debug('MessagingServiceProvider: Initialized with NATS_CONNECTION set to %s.', this._natsConnection);
                    return fulfill(true);
                });
            });
        }

        return true;
    }

    async _processMessage(message: Object, reply: Object, subject: string): Promise<boolean> {
        const eventPackage: TEventPackage = {
            'data': message,
            'timestamp': new Date()
        };

        return this.ee.emitAsync(subject, eventPackage);
    }

};
