/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */

const axios = require('axios');
const rax = require('retry-axios');
const querystring = require('querystring');

const config = require('../config');
const Logger = require('../config/logger');

const logger = new Logger('app-id-helper');

const url = process.env.APP_ID_URL;
const clientID = process.env.APP_ID_CLIENT_ID;
const tenantID = process.env.APP_ID_TENANT_ID;
const secret = process.env.APP_ID_SECRET;

// writer's responsibility to call validateConfig() before making requests to AppID
// eslint-disable-next-line complexity
const validateConfig = () => {
    let missingVar;
    if (!url) {
        missingVar = 'APP_ID_URL';
    } else if (!clientID) {
        missingVar = 'APP_ID_CLIENT_ID';
    } else if (!tenantID) {
        missingVar = 'APP_ID_TENANT_ID';
    } else if (!secret) {
        missingVar = 'APP_ID_SECRET';
    }

    if (missingVar) {
        throw new Error(`Invalid AppID config: missing variable '${missingVar}'`);
    }
};

const appIdLoginClient = () => {
    const loginClient = axios.create({
        baseURL: `${url}/token`,
        timeout: config.appID.timeout,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
        },
        auth: {
            username: clientID,
            password: secret,
        },
    });

    const retries = config.appID.retries || 1;
    const retryDelay = config.appID.retryDelay || 3000;

    // setup retry-axios config
    loginClient.defaults.raxConfig = {
        instance: loginClient,
        retry: retries,
        noResponseRetries: retries, // retry when no response received (such as on ETIMEOUT)
        statusCodesToRetry: [[500, 599]], // retry only on 5xx responses (no retry on 4xx responses)
        retryDelay,
        onRetryAttempt: (err) => {
            const cfg = rax.getConfig(err);
            logger.warn('No response received from AppID, retrying login request:');
            logger.warn(`Retry attempt #${cfg.currentRetryAttempt}`);
        },
    };

    rax.attach(loginClient);
    return loginClient;
};

const appIdUserInfoClient = (token) =>
    axios.create({
        baseURL: `${url}/userinfo`,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            Authorization: token,
        },
    });

const loginAppID = async (username, password) => {
    try {
        validateConfig();
        const loginClient = appIdLoginClient();

        const requestBody = {
            username,
            password,
            grant_type: 'password',
        };

        logger.debug('Calling AppID to retrieve auth token');

        const response = await loginClient.post('/', querystring.stringify(requestBody));

        logger.info('Login request to AppID was successful');

        return response.data;
    } catch (error) {
        logger.error(`Login request to AppID failed with error ${error}`);

        const errorObj = new Error();
        if (error.response) {
            const errorResponse = error.response;
            errorObj.status = errorResponse.status;
            errorObj.statusText = errorResponse.statusText;

            if ('data' in errorResponse) {
                errorObj.message = errorResponse.data.error_description;
            }
        } else {
            errorObj.status = 500;
            errorObj.statusText = error.code;
            errorObj.message = error.message;
        }

        throw errorObj;
    }
};

const getUserInfoJwt = () => ({
    sub: '1d44cdc1-4b78-4ef7-a5a2-08aabc13619f',
    name: 'Tester POC',
    email: 'tester@poc.com',
    given_name: 'Tester',
    family_name: 'POC',
});

const getUserInfoAppId = async (token) => {
    try {
        validateConfig();
        const appIdInfo = appIdUserInfoClient(token);
        const userInfo = await appIdInfo.post('/');
        return userInfo.data;
    } catch (error) {
        logger.error(`Userinfo request to AppID failed with error ${error}`);

        const errorObj = new Error();
        if (error.response) {
            errorObj.status = error.response.status;
            errorObj.statusText = error.response.statusText;
            errorObj.message = error.data.error_description;
        } else {
            errorObj.status = 500;
            errorObj.statusText = error.code;
            errorObj.message = error.message;
        }

        throw errorObj;
    }
};

const getUserInfo = (token) => {
    return process.env.AUTH_STRATEGY === 'DEVELOPMENT' ? getUserInfoJwt() : getUserInfoAppId(token);
};

module.exports = {
    loginAppID,
    getUserInfo,
};
