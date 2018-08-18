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

        this.logger.debug('Database: (CqlDriver) Available migrations: %j', availableMigrations);
        this.logger.debug('Database: (CqlDriver) Ran migrations: %j', ranMigrations);

        const availableMigrationsLength: number = availableMigrations.length;
        const ranMigrationsLength: number = ranMigrations.length;
        if(availableMigrationsLength > ranMigrationsLength) {
            const differenceNumber: number = availableMigrationsLength - ranMigrationsLength;

            this.logger.debug('Database: (CqlDriver) Available and ran migrations differ in %s items', differenceNumber);

            const differenceMigrations: Array<string> = takeRight(availableMigrations, differenceNumber);

            this.logger.debug('Database: (CqlDriver) Differences: %j', differenceMigrations);

            forEach(differenceMigrations, (notYetMigrated: string) => {
                if(indexOf(ranMigrations, notYetMigrated) >= Common.ZERO) {
                    throw new Error('Database: (CqlDriver) Migrations seem messed up. Please fix manually!');
                }
            });

            await this.runMigrations(migrationClient, differenceMigrations);
        }

        await this.disconnect(migrationClient);
    }

    async getRanMigrations(migrationClient: cql.Client): Promise<Array<string>> {
        this.logger.debug('Database: (CqlDriver) Getting migrations that already ran ...');
        const checkKeyspaceQuery: string = 'SELECT * FROM system_schema.tables WHERE keyspace_name = ?';
        const keyspaceInfoResult: Object|null = await this.execute(migrationClient, checkKeyspaceQuery, [this._keyspace]);

        this.logger.debug('Database: (CqlDriver) Keyspace query returned: %j', keyspaceInfoResult);

        if(keyspaceInfoResult !== null
        && keyspaceInfoResult.first() !== null) {

            const checkMigrationsTableQuery: string = 'SELECT table_name FROM system_schema.tables WHERE keyspace_name = ? AND table_name = ?';
            const checkMigrationsTableResult: Object|null = await this.execute(migrationClient, checkMigrationsTableQuery, [this._keyspace, 'migrations']);

            this.logger.debug('Database: (CqlDriver) Migrations table check query returned: %j', checkMigrationsTableResult);

            if(checkMigrationsTableResult !== null
            && checkMigrationsTableResult.first() !== null) {
                const migrationsTableQuery: string = `SELECT filename FROM ${this._keyspace}.migrations`;
                const migrationsTableQueryOptions: TCqlQueryOptions = {
                    'prepare': false,
                    'keyspace': this._keyspace
                };
                const migrationsTableResult: Object|null = await this.execute(migrationClient, migrationsTableQuery, [], migrationsTableQueryOptions);

                if(migrationsTableResult !== null
                && migrationsTableResult.first() !== null) {
                    return migrationsTableResult.rows.map(row => row.filename);
                }
            } else {
                this.logger.debug('Database: (CqlDriver) Migrations table does not exist, creating ...');

                const createMigrationsTableQuery: string = `CREATE TABLE IF NOT EXISTS ${this._keyspace}.migrations (filename text PRIMARY KEY, migrated_at timestamp)`;
                const createMigrationsTableResult: Object|null = await this.execute(migrationClient, createMigrationsTableQuery);

                this.logger.debug('Database: (CqlDriver) Migrations table create query returned: %j', createMigrationsTableResult);
            }
        }

        return [];
    }

    async getAvailableMigrations(): Promise<Array<string>> {
        this.logger.debug('Database: (CqlDriver) Getting all available migrations ...');

        const migrationsRootDir = path.join(this.getEnv('SERVICE_DIRNAME'), '..', 'migrations', 'cql');
        const migrationsUpRootDir = path.join(migrationsRootDir, 'up');

        return readDir(migrationsUpRootDir);
    }

    async runMigrations(migrationClient: cql.Client, migrationFiles: Array<string>): Promise<boolean> {
        this.logger.debug('Database: (CqlDriver) Running migrations (%j) ...', migrationFiles);

        let migrationsPromises: Array<Promise<boolean>> = [];

        const migrationFilesAmount: number = migrationFiles.length;
        for(let i = 0; i < migrationFilesAmount; i++) {
            const migrationFile = migrationFiles[i];
            try {
                const successful: boolean = await this.runMigration(migrationClient, migrationFile);

                if(successful === false) {
                    throw new Error('Retrieved an error.');
                }
            } catch(err) {
                this.logger.error('Database: (CqlDriver) Migration #%s (%s) failed:', i, migrationFile, err);
                return false;
            }
        }

        return true;
    }

    async runMigration(migrationClient: cql.Client, migrationFile: string): Promise<boolean> {
        this.logger.debug('Database: (CqlDriver) Running migration %s ...', migrationFile);

        const migrationFileContent: string = await this.getMigrationFileContent(migrationFile);
        this.logger.debug('Database: (CqlDriver) Migration is: %s ...', migrationFileContent);

        const migrationFileResult: Object|null = await this.execute(migrationClient, migrationFileContent);

        this.logger.debug('Database: (CqlDriver) Migration result: %j', migrationFileResult);

        if(migrationFileResult === null) {
            return false;
        }

        await this.storeMigration(migrationClient, migrationFile);

        return true;
    }

    async storeMigration(migrationClient: cql.Client, migrationFile: string): Promise<boolean> {
        this.logger.debug('Database: (CqlDriver) Storing migration %s ...', migrationFile);

        try {
            const insertMigrationQuery: string = `INSERT INTO ${this._keyspace}.migrations (filename, migrated_at) VALUES (?, ?)`; // IF NOT EXISTS - Scylla does not support LWT yet
            const insertMigrationResult: Object|null = await this.execute(migrationClient, insertMigrationQuery, [migrationFile, new Date()]);

            if(insertMigrationResult === null) {
                throw new Error('Retrieved an error.');
            }

            this.logger.debug('Database: (CqlDriver) Migration %s stored!', migrationFile);

            return true;
        } catch(err) {
            this.logger.debug('Database: (CqlDriver) Migration %s could not be stored: %j', migrationFile, err);
            return false;
        }
    }

    async getMigrationFileContent(migrationFile: string): Promise<string> {
        this.logger.debug('Database: (CqlDriver) Getting migration (%s) content ...', migrationFile);

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

    async execute(client: cql.Client, query: string, params?: Array<any>|Object, options?: TCqlQueryOptions): Promise<?Object> {
        try {
            this.logger.debug('Database: (CqlDriver) Executing query (%s) with params (%j) and options (%j) ...', query, params, options);
            const result = await client.execute(query, params, options);
            this.logger.debug('Database: (CqlDriver) Execution of query (%s) resulted in: %j', query, result);
            return result;
        } catch(err) {
            this.logger.error('Database: (CqlDriver) Execution of query (%s) resulted in an error: %j', query, err);
            return null;
        }
    }
};
