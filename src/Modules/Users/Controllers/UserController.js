//@flow

import type {
    TControllerConfig,
    TControllerParams,
    TControllerParamsReturn,
    TControllerDependenciesDefinition,
    TControllerActionReturn,
    TControllerRouteAclTable
} from 'paperframe/lib/Controller';

import type {
    TEventId,
    TEventPackage
} from 'paperframe/lib/Event';

const PaperworkController = require('paperwork-sdk-service-node/lib/PaperworkController');
const PaperworkStatusCodes = require('paperwork-sdk-service-node/lib/PaperworkStatusCodes');

const Joi = require('joi');
const HttpStatus = require('http-status-codes');

module.exports = class UserController extends PaperworkController {
    static get dependencies(): TControllerDependenciesDefinition {
        return ['database', 'messaging', 'kong'];
    }

    static get resource(): string {
        return 'user';
    }

    static get route(): string {
        return '/users';
    }

    get routeAcl(): TControllerRouteAclTable {
        let acl: TControllerRouteAclTable = {
            'index': {
                'protected': true
            },
            'show': {
                'protected': true
            },
            'create': {
                'protected': false
            }
        };

        return acl;
    }

    get eventListener(): string {
        return '**';
    }

    constructor(controllerConfig: TControllerConfig) {
        super(controllerConfig);
        this.aclToKong(UserController.resource, UserController.route, this.routeAcl);
    }

    onEvent(eventId: string, eventPackage: TEventPackage) {
        console.log(eventId);
        console.log(eventPackage);
    }

    async index(params: TControllerParams): TControllerActionReturn {
        const user = this.$C('user');
        return this.return(params, HttpStatus.OK, PaperworkStatusCodes.OK, {});
    }

    async show(params: TControllerParams): TControllerActionReturn {
        const user = this.$C('user');

        return this.return(params, HttpStatus.OK, PaperworkStatusCodes.OK, {});
    }

    /**
     * Before CREATE handler
     */
    async beforeCreate(params: TControllerParams): TControllerParamsReturn {
        const schema = Joi.object().keys({
            'email': Joi.string().email().required(),
            'password': Joi.string().strip().regex(/^.*(?=.{8,})(?=.*[a-zA-Z])(?=.*\d)(?=.*[!#$%&? "]).*$/).required() // TODO: Make the regex configurable
        });

        return this.validate(params, schema);
    }

    /**
     * CREATE handler
     */
    async create(params: TControllerParams): TControllerActionReturn {
        console.log(params);
        return this.return(params, HttpStatus.OK, PaperworkStatusCodes.OK, {});
    }
};
