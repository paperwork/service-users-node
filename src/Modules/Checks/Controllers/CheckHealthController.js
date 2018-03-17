//@flow

import type {
    ControllerConfig,
    ControllerParams,
    ControllerDependenciesDefinition,
    ControllerActionReturn,
    ControllerRouteAclTable
} from 'paperframe';

const PaperworkController = require('../../../Library/PaperworkController');
const PaperworkStatusCodes = require('../../../Library/PaperworkStatusCodes');

const Joi = require('joi');
const HttpStatus = require('http-status-codes');

module.exports = class CheckHealthController extends PaperworkController {
    static get dependencies(): ControllerDependenciesDefinition {
        return ['database', 'kong'];
    }

    static get resource(): string {
        return 'checkHealth';
    }

    static get route(): string {
        return '/checks/health';
    }

    get routeAcl(): ControllerRouteAclTable {
        let acl: ControllerRouteAclTable = {
            'index': {
                'protected': false
            }
        };

        return acl;
    }

    constructor(config: ControllerConfig) {
        super(config);
        this.aclToKong(CheckHealthController.resource, CheckHealthController.route, this.routeAcl);
    }

    async index(params: ControllerParams): ControllerActionReturn {
        return this.response(HttpStatus.OK, PaperworkStatusCodes.OK, {});
    }
};
