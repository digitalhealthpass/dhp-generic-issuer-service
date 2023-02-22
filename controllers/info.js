/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */

const path = require('path');
const fs = require('fs');

const Logger = require('../config/logger');
const constants = require('../helpers/constants');
const dccHelper = require('../helpers/dcc-helper');
const vciHelper = require('../helpers/vci-helper');

const logger = new Logger('info-controller');

// healthCheck is API entry point for GET /info
//
// @param {object} req - API request
// @param {object} res - API response
exports.release = async (req, res) => {
    logger.debug('Entering GET /info controller');
    const txID = req.headers[constants.REQUEST_HEADERS.TRANSACTION_ID];

    let releaseInfo = {};

    const releasePath = path.join(__dirname, '../.release');
    if (fs.existsSync(releasePath)) {
        const releaseFileInfo = JSON.parse(fs.readFileSync(releasePath, { encoding:'ascii', flag:'r' }));
        releaseInfo = {
            ...releaseFileInfo,
        }
    } else {
        logger.warn(`Release file does not exist: ${releasePath}`);
    }

    // TODO: No appId for now
    // releaseInfo.app_id = {};
    // releaseInfo.app_id.url = `${process.env.APP_ID_URL}`;
    // releaseInfo.app_id.client = `${process.env.APP_ID_CLIENT_ID}`;

    releaseInfo.dcc = await dccHelper.getInfo(txID);
    releaseInfo.vci = await vciHelper.getInfo(txID);

    return res.status(200).send({ message: 'Successfully retrieved information', payload: releaseInfo });
};
