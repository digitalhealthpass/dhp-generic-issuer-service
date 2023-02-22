/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */

const Logger = require('../config/logger');
const appConfig = require('../config/app/config.json');
const utils = require('../utils');
const constants = require('../helpers/constants');
const vciHelper = require('../helpers/vci-helper')

const logger = new Logger('vci-issuer-controller');

// getTrustList is API entry point for GET /generic-issuers/vci
//
// @param {object} req - API request
// @param {object} res - API response
exports.getTrustList = async (req, res) => {
    const txID = req.headers[constants.REQUEST_HEADERS.TRANSACTION_ID];
    logger.info('Entering GET /generic-issuers/vci controller', txID);

    // Start with any query parameters, overwrite values if corresponding request body parameter exists
    const query = { ...req.query };
    if (req.body?.url) query.url = req.body.url;
    logger.debug('Query parameters:', txID);
    logger.debug(query);

    const { status, data, message } = await vciHelper.getTrustList(txID, query);
    if (status === 200) {
        const out = {
            type: appConfig.vci.collectionType,
            payload: data
        }
        res.status(status).send({ message: 'Successfully retrieved VCI issuer information', payload: out });
    } else
        res.status(status).send({ error: { message: `Unable to retrieve VCI issuer information: ${message}`}});
}

// insertIssuerIntoTrustList is API entry point for POST /generic-issuers/vci
//
// @param {object} req - API request
// @param {object} res - API response
exports.insertIssuerIntoTrustList = async (req, res) => {
    const txID = req.headers[constants.REQUEST_HEADERS.TRANSACTION_ID];
    logger.info('Entering POST /generic-issuers/vci controller', txID);

    if (utils.validateReqBody(req, res, appConfig.vci.requiredFields)) {
        const { status, data, message } = await vciHelper.addIssuer(txID, req.body);
        if (status === 200)
            res.status(201).send({ message: 'Successfully added VCI issuer', payload: data });
        else
            res.status(status).send({ error: { message: `Unable to add VCI issuer: ${message}`}});
    }
}

// updateIssuerInTrustList is API entry point for PUT /generic-issuers/vci
//
// @param {object} req - API request
// @param {object} res - API response
exports.updateIssuerInTrustList = async (req, res) => {
    const txID = req.headers[constants.REQUEST_HEADERS.TRANSACTION_ID];
    logger.info('Entering PUT /generic-issuers/vci controller', txID);

    if (utils.validateReqBody(req, res, appConfig.vci.requiredFields)) {
        const { status, data, message } = await vciHelper.updateIssuer(txID, req.body);
        if (status === 200)
            res.status(status).send({ message: 'Successfully updated VCI issuer', payload: data });
        else
            res.status(status).send({ error: { message: `Unable to update VCI issuer: ${message}`}});
    }
}

// getIssuerFromTrustList is API entry point for GET /generic-issuers/vci/{id}
//
// @param {object} req - API request
// @param {object} res - API response
exports.getIssuerFromTrustList = async (req, res) => {
    const txID = req.headers[constants.REQUEST_HEADERS.TRANSACTION_ID];
    logger.info('Entering GET /generic-issuers/vci/{id} controller', txID);

    const { status, data, message } = await vciHelper.getIssuer(txID, req.params.id);
    if (status === 200)
        res.status(status).send({ message: 'Successfully retrieved VCI issuer', payload: data });
    else
        res.status(status).send({ error: { message: `Unable to retrieve VCI issuer: ${message}`}});
}

// getIssuerFromTrustListByUrl is API entry point for GET /generic-issuers/vci/list/url
//
// @param {object} req - API request
// @param {object} res - API response
exports.getIssuerFromTrustListByUrl = async (req, res) => {
    const txID = req.headers[constants.REQUEST_HEADERS.TRANSACTION_ID];
    logger.info('Entering GET /generic-issuers/vci/list/url controller', txID);

    if (utils.validateReqBody(req, res, [appConfig.vci.persistenceKey])) {
        const { status, data, message } = await vciHelper.getIssuer(txID, req.body[appConfig.vci.persistenceKey]);
        if (status === 200)
            res.status(status).send({ message: 'Successfully retrieved VCI issuer', payload: data });
        else
            res.status(status).send({ error: { message: `Unable to retrieve VCI issuer: ${message}`}});
    }
}

// removeIssuerFromTrustList is API entry point for DELETE /generic-issuers/vci/{id}
//
// @param {object} req - API request
// @param {object} res - API response
exports.removeIssuerFromTrustList = async (req, res) => {
    const txID = req.headers[constants.REQUEST_HEADERS.TRANSACTION_ID];
    logger.info('Entering DELETE /generic-issuers/vci/{id} controller', txID);

    const { status, data, message } = await vciHelper.deleteIssuer(txID, req.params.id);
    if (status === 200)
        res.status(status).send({ message: 'Successfully deleted VCI issuer', payload: data });
    else
        res.status(status).send({ error: { message: `Unable to delete VCI issuer: ${message}`}});
}