/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */

const Logger = require('../config/logger');
const constants = require('../helpers/constants');

const logger = new Logger('health-controller');

// healthCheck is API entry point for GET /health
//
// @param {object} req - API request
// @param {object} res - API response
exports.healthCheck = async (req, res) => {
    const txID = req.headers[constants.REQUEST_HEADERS.TRANSACTION_ID];
    logger.info('Entering GET /health controller', txID);

    const results = [];
    const errorOccurred = false;

    // Check health of any required services

    const statusCode = errorOccurred ? 500 : 200;
    const statusText = errorOccurred ? 'fail' : 'ok';
    if (req.query.details === 'true')
        res.status(statusCode).send({ message: statusText, payload: results });
    else 
        res.status(statusCode).send({ message: statusText });
};
