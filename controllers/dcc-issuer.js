/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */

const Logger = require('../config/logger');
const appConfig = require('../config/app/config.json');
const utils = require('../utils');
const constants = require('../helpers/constants');
const dccHelper = require('../helpers/dcc-helper')

const logger = new Logger('dcc-issuer-controller');

// getTrustList is API entry point for GET /generic-issuers/dcc
//
// @param {object} req - API request
// @param {object} res - API response
exports.getTrustList = async (req, res) => {
    const txID = req.headers[constants.REQUEST_HEADERS.TRANSACTION_ID];
    logger.info('Entering GET /generic-issuers/dcc controller', txID);

    // Start with any query parameters, overwrite values if corresponding path parameter exists
    const query = { ...req.query };
    if (req.params.type) query.certificateType = req.params.type;
    if (req.params.country) query.country = req.params.country;
    logger.debug('Query parameters:', txID);
    logger.debug(query);

    const { status, data, message } = await dccHelper.getTrustList(txID, query);
    if (status === 200) {
        const out = {
            type: appConfig.dcc.collectionType,
            payload: data
        }
        res.status(status).send({ message: 'Successfully retrieved DCC issuer information', payload: out });
    } else
        res.status(status).send({ error: { message: `Unable to retrieve DCC issuer information: ${message}`}});
}

// insertIssuerIntoTrustList is API entry point for POST /generic-issuers/dcc
//
// @param {object} req - API request
// @param {object} res - API response
exports.insertIssuerIntoTrustList = async (req, res) => {
    const txID = req.headers[constants.REQUEST_HEADERS.TRANSACTION_ID];
    logger.info('Entering POST /generic-issuers/dcc controller', txID);

    if (utils.validateReqBody(req, res, appConfig.dcc.requiredFields)) {
        const { status, data, message } = await dccHelper.addIssuer(txID, req.body);
        if (status === 200)
            res.status(201).send({ message: 'Successfully added DCC issuer', payload: data });
        else
            res.status(status).send({ error: { message: `Unable to add DCC issuer: ${message}`}});
    }
}

// getIssuerFromTrustList is API entry point for GET /generic-issuers/dcc/{id}
//
// @param {object} req - API request
// @param {object} res - API response
exports.getIssuerFromTrustList = async (req, res) => {
    const txID = req.headers[constants.REQUEST_HEADERS.TRANSACTION_ID];
    logger.info('Entering GET /generic-issuers/dcc/{id} controller', txID);

    const { status, data, message } = await dccHelper.getIssuer(txID, req.params.id);
    if (status === 200)
        res.status(status).send({ message: 'Successfully retrieved DCC issuer', payload: data });
    else
        res.status(status).send({ error: { message: `Unable to retrieve DCC issuer: ${message}`}});
}

// removeIssuerFromTrustList is API entry point for DELETE /generic-issuers/dcc/{id}
//
// @param {object} req - API request
// @param {object} res - API response
exports.removeIssuerFromTrustList = async (req, res) => {
    const txID = req.headers[constants.REQUEST_HEADERS.TRANSACTION_ID];
    logger.info('Entering DELETE /generic-issuers/dcc/{id} controller', txID);

    const { status, data, message } = await dccHelper.deleteIssuer(txID, req.params.id);
    if (status === 200)
        res.status(status).send({ message: 'Successfully deleted DCC issuer', payload: data });
    else
        res.status(status).send({ error: { message: `Unable to delete DCC issuer: ${message}`}});
}
