//@flow

const Driver = require('paperframe/lib/ServiceProviders/Database/Driver');
const Common = require('paperframe/lib/Common');
const cql = require('cassandra-driver');
const path = require('path');
const fs = require('fs');
const util = require('util');
const sortBy = require('lodash/sortBy');
const takeRight = require('lodash/takeRight');
const forEach = require('lodash/forEach');
const indexOf = require('lodash/indexOf');

const readDir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);

export type TCqlContactPoints = Array<string>;

export type TCqlPolicies = {
    'loadBalancing': any,
    'retry': any,
    'reconnection': any,
    'addressResolution': any,
    'timestampGeneration': ?any
};

export type TCqlExecutionProfile = string|cql.ExecutionProfile;

export type TCqlHints = Array<string>|Array<Array<string>>;

export type TCqlPageState = Buffer|string;

export type TCqlRoutingKey = Buffer|Array<string>;

export type TCqlQueryOptions = {
    'autoPage'?: boolean,
    'captureStackTrace'?: boolean,
    'consistency'?: number,
    'customPayload'?: Object,
    'executionProfile'?: TCqlExecutionProfile,
    'fetchSize'?: number,
    'hints'?: TCqlHints,
    'isIdempotent'?: boolean,
    'keyspace'?: string,
    'logged'?: boolean,
    'pageState'?: TCqlPageState,
    'prepare'?: boolean,
    'readTimeout'?: number,
    'retry'?: any,
    'retryOnTimeout'?: boolean,
    'routingIndexes'?: Array<string>,
    'routingKey'?: TCqlRoutingKey,
    'routingNames'?: Array<string>,
    'serialConsistency'?: number,
    'timestamp'?: number,
    'traceQuery'?: boolean
};

export type TCqlPooling = {
    'heartBeatInterval'?: number,
    'coreConnectionsPerHost'?: Object,
    'warmup'?: boolean
};

export type TCqlProtocolOptions = {
    'port'?: number,
    'maxSchemaAgreementWaitSeconds'?: number,
    'maxVersion'?: number
};

export type TCqlSocketOptions = {
    'connectTimeout'?: number,
    'defunctReadTimeoutThreshold'?: number,
    'keepAlive'?: boolean,
    'keepAliveDelay'?: number,
    'readTimeout'?: number,
    'tcpNoDelay'?: boolean,
    'coalescingThreshold'?: number
};

export type TCqlAuthProvider = cql.AuthProvider;

export type TCqlEncoding = {
    'map'?: Function,
    'set'?: Function,
    'copyBuffer'?: boolean,
    'useUndefinedAsUnset'?: boolean
};

export type TCqlProfiles = Array<cql.ExecutionProfile>;

export type TCqlClientOptions = {
    'contactPoints': TCqlContactPoints,
    'keyspace'?: string,
    'refreshSchemaDelay'?: number,
    'isMetadataSyncEnabled'?: boolean,
    'policies'?: TCqlPolicies,
    'queryOptions'?: TCqlQueryOptions,
    'pooling'?: TCqlPooling,
    'protocolOptions'?: TCqlProtocolOptions,
    'socketOptions'?: TCqlSocketOptions,
    'authProvider'?: TCqlAuthProvider,
    'sslOptions'?: Object,
    'encoding'?: TCqlEncoding,
    'profiles'?: TCqlProfiles,
    'promiseFactory'?: Function
}

module.exports = class CqlDriver extends Driver {
    _contactPoints:             TCqlContactPoints
    _keyspace:                  string
    _client:                    cql.Client

    initialize(): boolean {
        this.initializeContactPoints();
        this.initializeKeyspace();

        this.prepareAndConnect();

        return true;
    }

    initializeContactPoints(): boolean {
        const envContactPoints = this.getEnv('DATABASE_CQL_CONTACT_POINTS') || '[]';
        this._contactPoints = JSON.parse(envContactPoints);

        if(typeof this._contactPoints !== 'object'
        || Array.isArray(this._contactPoints) === false
        || this._contactPoints.length === Common.ZERO) {
            throw new Error('Database: (CqlDriver) No contact points configured! Please define DATABASE_CQL_CONTACT_POINTS in your environment.');
        }

        this.logger.debug('Database: (CqlDriver) Initialized conatct points: %j', this._contactPoints);

        return true;
    }

    initializeKeyspace(): boolean {
        this._keyspace = this.getEnv('DATABASE_CQL_KEYSPACE');

        if(typeof this._keyspace !== 'string'
        || this._keyspace.length === Common.ZERO) {
            throw new Error('Database: (CqlDriver) No keyspace configured! Please define DATABASE_CQL_KEYSPACE in your environment.');
        }

        this.logger.debug('Database: (CqlDriver) Initialized keyspace: %s', this._keyspace);

        return true;
    }

    async prepareAndConnect() {
        const migrationClientOptions: TCqlClientOptions = {
            'contactPoints': this._contactPoints
        };

        const migrationClient = await this.connect(migrationClientOptions);

        const availableMigrations: Array<string> = sortBy(await this.getAvailableMigrations());
        const ranMigrations: Array<string> = sortBy(await this.getRanMigrations(migrationClient));

        const availableMigrationsLength: number = availableMigrations.length;
        const ranMigrationsLength: number = ranMigrations.length;
        if(availableMigrationsLength > ranMigrationsLength) {
            const differenceNumber: number = availableMigrationsLength - ranMigrationsLength;

            const differenceMigrations: Array<string> = takeRight(availableMigrations, differenceNumber);

            forEach(differenceMigrations, (notYetMigrated: string) => {
                if(indexOf(ranMigrations, notYetMigrated) >= Common.ZERO) {
                    throw new Error('Migrations seem messed up. Please fix manually!');
                }
            });

            await this.runMigrations(migrationClient, differenceMigrations);
        }

        await this.disconnect(migrationClient);
    }

    async getRanMigrations(migrationClient: cql.Client): Promise<Array<string>> {
        const checkKeyspaceQuery: string = 'SELECT * FROM system_schema.tables WHERE keyspace_name = ?;';
        const keyspaceInfoResult: Object = await migrationClient.execute(checkKeyspaceQuery, [this._keyspace]);

        if(keyspaceInfoResult.hasOwnProperty('rows')
        && keyspaceInfoResult.rows.length > Common.ZERO) {
            const migrationsTableQuery: string = 'SELECT filename FROM migrations;';
            const migrationsTableQueryOptions: TCqlQueryOptions = {
                'keyspace': this._keyspace
            };
            const migrationsTableResult: Object = await migrationClient.execute(migrationsTableQuery, [], migrationsTableQueryOptions);

            if(migrationsTableResult.hasOwnProperty('rows')
            && migrationsTableResult.rows.length > Common.ZERO) {
                return migrationsTableResult.rows.map(row => row.filename);
            }

            return [];
        }

        return [];
    }

    async getAvailableMigrations(): Promise<Array<string>> {
        const migrationsRootDir = path.join(this.getEnv('SERVICE_DIRNAME'), '..', 'migrations', 'cql');
        const migrationsUpRootDir = path.join(migrationsRootDir, 'up');

        return readDir(migrationsUpRootDir);
    }

    async runMigrations(migrationClient: cql.Client, migrationFiles: Array<string>) {
        let migrationsPromises: Array<Promise<boolean>> = [];

        forEach(migrationFiles, async (migrationFile: string) => {
            migrationsPromises.push(this.runMigration(migrationClient, migrationFile));
        });

        return Promise.all(migrationsPromises);
    }

    async runMigration(migrationClient: cql.Client, migrationFile: string): Promise<boolean> {
        const migrationFileContent: string = await this.getMigrationFileContent(migrationFile);

        const migrationFileResult: Object = await migrationClient.execute(migrationFileContent);

        console.log(migrationFileResult);

        return true;
    }

    async getMigrationFileContent(migrationFile: string): Promise<string> {
        const migrationFilePath = path.join(this.getEnv('SERVICE_DIRNAME'), '..', 'migrations', 'cql', 'up', migrationFile);
        return readFile(migrationFilePath, 'utf8');
    }

    async connect(clientOptions: TCqlClientOptions): cql.Client {
        this.logger.debug('Database: (CqlDriver) Connecting ...');

        const client = new cql.Client(clientOptions);
        client.on('log', (level: string, className: string, message: string, furtherInfo: any) => {
            let loggerMethod = level;

            if(this.logger.hasOwnProperty(level) === false) {
                loggerMethod = 'debug';
            }

            // @flowIgnore TODO: Fix this
            this.logger[loggerMethod]('Database: (CqlDriver) (%s) %s %j', className, message, furtherInfo);
        });

        await client.connect();
        return client;
    }

    async disconnect(client: cql.Client): cql.Client {
        this.logger.debug('Database: (CqlDriver) Disconnecting ...');
        return client.shutdown();
    }
};
