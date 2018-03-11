//@flow

import type {
    ControllerParams,
    ControllerRouteAclTable
} from 'paperframe';

const JsonController = require('paperframe').JsonController;

const Joi = require('joi');
const HttpStatus = require('http-status-codes');
const busboy = require('async-busboy');
const forEach = require('lodash').forEach;

module.exports = class PaperworkController extends JsonController {
    validate(params: ControllerParams, schema: Object): ControllerParams {
        const validationResult = Joi.validate(params.body, schema);
        if(validationResult.error === null) {
            params.body = validationResult.value;
            return params;
        }

        this.response(HttpStatus.BAD_REQUEST, module.exports.RS_REQUEST_VALIDATION_FAILED, validationResult.error.details);
        throw validationResult.error;
    }

    aclToKong(resource: string, route: string, aclTable: ControllerRouteAclTable) {
        forEach(aclTable, async (aclEntry: Object, aclMethod: string) => {
            let method: string;
            let uri: string;
            const isProtected: boolean = aclEntry.protected || false;

            switch(aclMethod) {
            case 'index':
                method = 'GET';
                uri = `${route}$`;
                break;
            case 'show':
                method = 'GET';
                uri = `${route}/[^\/]+$`;
                break;
            case 'create':
                method = 'POST';
                uri = `${route}$`;
                break;
            case 'update':
                method = 'PUT';
                uri = `${route}/[^\/]+$`;
                break;
            case 'destroy':
                method = 'DELETE';
                uri = `${route}/[^\/]+$`;
                break;
            default:
                return true;
            }

            return this.$S('kong').createApi(method, aclMethod, resource, uri, isProtected);
        });
    }
};
