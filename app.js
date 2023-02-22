/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */

const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const fs = require('fs');
const https = require('https');
const morgan = require('morgan');
const passport = require('passport');
const path = require('path');
const swaggerUI = require('swagger-ui-express');

const pingRoutes = require('./routes/ping');
const healthRoutes = require('./routes/health');
const infoRoutes = require('./routes/info');
const genericIssuerRoutes = require('./routes/generic-issuer');

const swaggerDoc = require('./swagger.json');
const tlsHelper = require('./helpers/tls-helper');
const cronHelper = require('./helpers/cron-helper');
const Logger = require('./config/logger');

const logger = new Logger('app');
const app = express();
const port = process.env.PORT || 3000;
const contextRoot = process.env.CONTEXT_ROOT || '';
let useHTTPS = false;
let serverCert;
let serverKey;

logger.info(`NODE JS RUNNING ON ${process.version}`);

if (process.env.USE_HTTPS && (process.env.USE_HTTPS === 'true' || process.env.USE_HTTPS === 'TRUE')) {
    useHTTPS = true;
    const tlsFolder = process.env.TLS_FOLDER_PATH || './config/tls';
    serverCert = path.resolve(tlsFolder, 'server.cert');
    serverKey = path.resolve(tlsFolder, 'server.key');

    logger.info(`process.env.USE_HTTPS = ${process.env.USE_HTTPS}`);
    logger.info(`Using server.key & server.cert from folder = ${tlsFolder}`);
    logger.info(`server cert file = ${serverCert}`);
    logger.info(`server key file = ${serverKey}`);
}

process.on('warning', (warning) => {
    logger.warn('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    logger.warn(`Warning name: ${warning.name}`);
    logger.warn(`Warning message: ${warning.message}`);
    logger.warn(`Stack trace: ${warning.stack}`);
    logger.warn('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
});

process.on('unhandledRejection', (reason, p) => {
    logger.warn('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    logger.warn(`Unhandled Rejection at promise: ${JSON.stringify(p)} reason: ${reason}`);
    logger.warn('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
});

process.on('uncaughtException', (err) => {
    logger.warn('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    logger.warn(`Uncaught exception = ${err}`);
    logger.warn(`Uncaught stack = ${err.stack}`);
    logger.warn('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
});

const onStartUp = async (err) => {
    if (err) {
        logger.error(`Error starting server: ${err}`);
    }

    await cronHelper.startCronJobs();

    logger.info(`Server running on port ${port}`);
};

app.use(cors());
app.use(morgan('dev'));
app.use(
    bodyParser.urlencoded({
        extended: false,
    })
);
app.use(bodyParser.json());
app.use(passport.initialize());
app.disable('x-powered-by');

// routes which should handle requests
app.use(`${contextRoot}/ping`, pingRoutes);
app.use(`${contextRoot}/health`, healthRoutes);
app.use(`${contextRoot}/info`, infoRoutes);
app.use(`${contextRoot}/generic-issuers`, genericIssuerRoutes);
app.use(`${contextRoot}/api-docs`, swaggerUI.serve, swaggerUI.setup(swaggerDoc));

app.use((req, res, next) => {
    const error = new Error('No route found');
    error.status = 404;
    next(error);
});

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
    res.status(error.status || 500);
    res.json({
        error: {
            message: error.message,
        },
    });
});

if (useHTTPS) {
    const foundKeyFiles = tlsHelper.validateSSLFiles(serverKey, serverCert);
    if (foundKeyFiles) {
        const options = {
            key: fs.readFileSync(serverKey),
            cert: fs.readFileSync(serverCert),
            secureOptions: tlsHelper.getSecureOptions(),
            ciphers: tlsHelper.getCiphersForServerOptions(),
            honorCipherOrder: true,
        };
        https.createServer(options, app).listen(port, onStartUp);
    }
} else {
    app.listen(port, onStartUp);
}

module.exports = app;
