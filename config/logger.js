/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */

const log4js = require('log4js');
const config = require('./index');

log4js.configure({
    appenders: {
        out: { type: 'console' },
    },
    categories: {
        default: { appenders: ['out'], level: config.log.level },
    },
});

// wrapper class for log4js logger
// logs transactionID with messages for traceability
// option to obfuscate specific data fields potentially containing PII
const Logger = class {
    constructor(moduleName) {
        // list of request/response-body field names that contain PII
        this.piFields = [
            'name',
            'givenName',
            'familyName',
            'givenname',
            'familyname',
            'mrn',
            'subjectid',
            'data',
            'caPassword',
            'ca_password',
            'credential',
            'certificate',
        ];
        this.logger = log4js.getLogger(moduleName);
        this.logger.level = config.log.level;
    }

    // eslint-disable-next-line class-methods-use-this
    formatMessage(message, txID) {
        if (txID) return `"x-providerdco-txn-id:${txID}" ${message}`;
        return message;
    }

    obfuscate(piObject) {
        const obfuscatedObject = { ...piObject };
        this.piFields.forEach((field) => {
            if (field in piObject) {
                // data is a generic object that could contain any amount of sensitive data
                if (field === 'data') {
                    obfuscatedObject[field] = '{ ... }';
                } else {
                    obfuscatedObject[field] = 'xxx';
                }
            }
        });

        return obfuscatedObject;
    }

    safeDebug(message, piArg, txID) {
        const logMessage = this.formatMessage(message, txID);
        const safeArg = this.obfuscate(piArg);
        this.logger.debug(logMessage, JSON.stringify(safeArg, null, 4));
    }

    safeInfo(message, piArg, txID) {
        const logMessage = this.formatMessage(message, txID);
        const safeArg = this.obfuscate(piArg);
        this.logger.info(logMessage, JSON.stringify(safeArg, null, 4));
    }

    safeWarn(message, piArg, txID) {
        const logMessage = this.formatMessage(message, txID);
        const safeArg = this.obfuscate(piArg);
        this.logger.warn(logMessage, JSON.stringify(safeArg, null, 4));
    }

    safeError(message, piArg, txID) {
        const logMessage = this.formatMessage(message, txID);
        const safeArg = this.obfuscate(piArg);
        this.logger.error(logMessage, JSON.stringify(safeArg, null, 4));
    }

    debug(message, txID) {
        const logMessage = this.formatMessage(message, txID);
        this.logger.debug(logMessage);
    }

    info(message, txID) {
        const logMessage = this.formatMessage(message, txID);
        this.logger.info(logMessage);
    }

    warn(message, txID) {
        const logMessage = this.formatMessage(message, txID);
        this.logger.warn(logMessage);
    }

    error(message, txID) {
        const logMessage = this.formatMessage(message, txID);
        this.logger.error(logMessage);
    }
};

module.exports = Logger;
