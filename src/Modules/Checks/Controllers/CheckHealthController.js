//@flow

import type {
    ControllerConfig,
    ControllerParams,
    ControllerDependenciesDefinition,
    ControllerActionReturn,
    ControllerRouteAclTable
} from 'paperframe/lib/Controller';

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

    async index(params: ControllerParams): ControllerActionReturn {
        return this.response(HttpStatus.OK, PaperworkStatusCodes.OK, {});
    }
};
