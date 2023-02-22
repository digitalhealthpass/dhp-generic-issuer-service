/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */

const passport = require('passport');
const appID = require('ibmcloud-appid');

const constants = require('../helpers/constants');

const { APIStrategy } = appID;
const appIDUrl = process.env.APP_ID_URL;

passport.use(
    new APIStrategy({
        oauthServerUrl: appIDUrl,
    })
);

const authenticateStandardUser = passport.authenticate(APIStrategy.STRATEGY_NAME, {
    session: false,
});

const authenticateHealthpassAdmin = passport.authenticate(APIStrategy.STRATEGY_NAME, {
    session: false,
    scope: constants.APP_ID_ROLES.HEALTHPASS_ADMIN,
});

const authenticateIssuersRead = passport.authenticate(APIStrategy.STRATEGY_NAME, {
    session: false,
    scope: constants.APP_ID_ROLES.ISSUERS_READ,
});

const authenticateIssuersWrite = passport.authenticate(APIStrategy.STRATEGY_NAME, {
    session: false,
    scope: constants.APP_ID_ROLES.ISSUERS_WRITE,
});

module.exports = {
    authenticateStandardUser,
    authenticateHealthpassAdmin,
    authenticateIssuersRead,
    authenticateIssuersWrite,
};
