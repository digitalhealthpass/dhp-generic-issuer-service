/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */

const Logger = require('../config/logger');
const dccHelper = require('./dcc-helper');
const vciHelper = require('./vci-helper');

const logger = new Logger('cron-helper');

exports.startCronJobs = async () => {
    logger.info('Starting cron jobs');

    // Do not await any asynchronous cron jobs, they're supposed to run forever ;-)
    dccHelper.startSynchronization();
    vciHelper.startSynchronization();
}