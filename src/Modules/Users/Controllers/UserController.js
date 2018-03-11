//@flow

import type {
    ControllerConfig,
    ControllerParams,
    ControllerDependenciesDefinition,
    ControllerActionReturn,
    ControllerRouteAclTable,
    EventId,
    EventPackage
} from 'paperframe';

const PaperworkController = require('../../../Library/PaperworkController');
const PaperworkStatusCodes = require('../../../Library/PaperworkStatusCodes');

const Joi = require('joi');
const HttpStatus = require('http-status-codes');

module.exports = class UserController extends PaperworkController {
    static get dependencies(): ControllerDependenciesDefinition {
        return ['database', 'kong'];
    }

    static get resource(): string {
        return 'user';
    }

    static get route(): string {
        return '/users';
    }

    get routeAcl(): ControllerRouteAclTable {
        let acl: ControllerRouteAclTable = {
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

    constructor(controllerConfig: ControllerConfig) {
        super(controllerConfig);
        this.aclToKong(UserController.resource, UserController.route, this.routeAcl);
    }

    onEvent(eventId: string, eventPackage: EventPackage) {
        console.log(eventId);
        console.log(eventPackage);
    }

    async index(params: ControllerParams): ControllerActionReturn {
        const user = this.$C('user');
        return this.response(HttpStatus.OK, PaperworkStatusCodes.OK, {});
    }

    async show(params: ControllerParams): ControllerActionReturn {
        const user = this.$C('user');
        return this.response(HttpStatus.OK, PaperworkStatusCodes.OK, {});
    }

    /**
     * Before CREATE handler
     */
    async beforeCreate(params: ControllerParams): ControllerParams {
        const schema = Joi.object().keys({
            'email': Joi.string().email().required(),
            'password': Joi.string().strip().regex(/^.*(?=.{8,})(?=.*[a-zA-Z])(?=.*\d)(?=.*[!#$%&? "]).*$/).required() // TODO: Make the regex configurable
        });

        return this.validate(params, schema);
    }

    /**
     * CREATE handler
     */
    async create(params: ControllerParams): ControllerActionReturn {
        console.log(params);
        return this.response(HttpStatus.OK, PaperworkStatusCodes.OK, {});
    }
};
