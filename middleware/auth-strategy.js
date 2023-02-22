/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */

const jwtAuth = require('./jwt-auth');
const appIDAuth = require('./app-id-auth');
const constants = require('../helpers/constants');

// eslint-disable-next-line complexity
const getAuthStrategy = (role) => {
    if (process.env.AUTH_STRATEGY === 'DEVELOPMENT') {
        return jwtAuth;
    }

    let authStrategy;
    if (role === constants.APP_ID_ROLES.PROVIDERDCO_ADMIN) {
        authStrategy = appIDAuth.authenticateProviderDcoAdmin;
    } else {
        authStrategy = appIDAuth.authenticateStandardUser;
    }

    return authStrategy;
};

module.exports = {
    getAuthStrategy,
};
