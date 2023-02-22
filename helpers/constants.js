/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */

exports.APP_ID_ROLES = {
    HEALTHPASS_ADMIN: 'healthpass.admin',
    ISSUERS_READ: 'issuers.read',
    ISSUERS_WRITE: 'issuers.write',
};

exports.ERROR_CODES = {
    TIMEOUT: 'ECONNABORTED',
};

exports.REQUEST_HEADERS = {
    ISSUER_ID: 'x-hpass-issuer-id',
    TRANSACTION_ID: 'x-providerdco-txn-id',
};
