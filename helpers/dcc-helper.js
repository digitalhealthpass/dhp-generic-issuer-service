/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */
/* eslint-disable no-await-in-loop, complexity, no-restricted-syntax */

const axios = require('axios');

const Logger = require('../config/logger');
const utils = require('../utils');
const appConfig = require('../config/app/config.json');
const persistenceHelper = require('./persistence-helper');

const logger = new Logger('dcc-helper');

// Getting list of DCC trusted issuers is one-step process:
// 1) Get list of certicates
//
// Primary key for persistence is kid

// Global variables used by GET /info API
let syncInterval;
let syncDuration;
let syncNumber = 0;
let numInserts = 0;
let numDeletes = 0;

// isEqual compares two DCC objects
// NOTE: Because DCC does not have embedded objects, we only need "shallow" compare
//
// @param {object} dcc1 - DCC object #1
// @param {object} dcc2 - DCC object #2
// @return {boolean} - true if DCC objects are equal, false otherwise
function isEqual(dcc1, dcc2) {
    const keys1 = Object.keys(dcc1);
    const keys2 = Object.keys(dcc2);
    if (keys1.length !== keys2.length) return false;
    for (const key of keys1)
        if (dcc1[key] !== dcc2[key]) return false;
    return true;
}

// getDataFromSource gets list of trusted issuers from configured DCC source
//
// @param {string} txID - transaction ID (logging purposes only)
// @return {object} - array of trusted issuers or null if error occurred
const getDataFromSource = async (txID) => {
    logger.debug('Entering getDataFromSource', txID);

    const gateway = appConfig.dcc.gateways[appConfig.dcc.gateway];
    if (!gateway || !gateway.baseUrl) {
        const err = new Error(`Invalid config, unrecognized DCC gateway ${appConfig.dcc.gateway}`);
        err.statusCode = 500;
        throw err;  // throw this one since getDataFromSource will never work without valid gateway
    }

    const dccApi = axios.create({
        baseURL: gateway.baseUrl,
        timeout: appConfig.dcc.timeout,
        headers: {
            Accept: '*'
        }
    });

    const timeStart = Date.now();
    let { retries } = appConfig.dcc;
    while (retries >= 0) {
        try {
            logger.debug('Calling DCC', txID);
            const apiRes = await dccApi.get();
            if (typeof apiRes.data === 'string') {
                const strRes = apiRes.data.split(/\r?\n/);;
                const objRes = JSON.parse(strRes[1]);
                const trustList = objRes.certificates;
                logger.debug(`DCC returned ${trustList.length} certificates`, txID);

                syncDuration = Date.now() - timeStart;
                logger.debug(`getDataFromSource took ${syncDuration}ms`, txID);
                return trustList;
            }
                
            logger.error(`Received unknown object (${typeof apiRes.data})`, txID);
            return null;
        } catch (err) {
            if (err.statusCode === 429 || err.statusCode >= 500) {
                logger.debug(`Received ${err.statsusCode} and attempting retry, ${retries} remaining`, txID);
                retries -= 1;
            } else {
                logger.error(`Received ${err.statsusCode}, aborting retries`, txID);
                return null;  // Eat exception
            }
        }
    }
    return null;
}

// synchronizePersistentData gets trust list from DCC source and then persists it through creates/updates
//
// @param {string} txID - transaction ID (logging purposes only)
const synchronizePersistentData = async (txID) => {
    logger.debug('Entering synchronizePersistentData', txID);

    const newTrustList = await getDataFromSource(txID);
    const currentTrustList = await persistenceHelper.readObjectsFromPersistence(txID, appConfig.dcc.persistenceName);
    let numInserts = 0;
    let numUpdates = 0;

    if (newTrustList) {
        if (!currentTrustList) {
            // Easy peesy, write 'em all
            await persistenceHelper.writeObjectsToPersistence(txID, appConfig.dcc.persistenceName, newTrustList);
            numInserts = newTrustList.length;
        } else {
            // Little tougher, gotta figure out what's new and what's changed
            const newTrustElements = [];
            const changedTrustElements = [];
            for (let i = 0; i < newTrustList.length; i += 1) {
                const newTrustElement = newTrustList[i];
                const currentTrustListMatches = currentTrustList.filter(obj => {
                    return obj[appConfig.dcc.persistenceKey] === newTrustElement[appConfig.dcc.persistenceKey];
                });
                if (!currentTrustListMatches || !currentTrustListMatches.length) {
                    // New element, insert!
                    newTrustElements.push(newTrustElement);
                    numInserts += 1;
                    logger.debug(`Inserting issuer with PK ${newTrustElement[appConfig.dcc.persistenceKey]}`, txID);
                } else if (currentTrustListMatches.length > 1) {
                    logger.error(`Multiple elements with same key ${newTrustElement[appConfig.dcc.persistenceKey]}!`,
                        txID);
                } else if (!isEqual(newTrustElement, currentTrustListMatches[0])) {
                    // Existing element, update!
                    changedTrustElements.push(newTrustElement);
                    numUpdates += 1;
                    logger.debug(`Updating issuer with PK ${newTrustElement[appConfig.dcc.persistenceKey]}`, txID);
                }
            }

            if (newTrustElements.length)
                await persistenceHelper.writeObjectsToPersistence(txID,
                    appConfig.dcc.persistenceName, newTrustElements);
            if (changedTrustElements.length)
                await persistenceHelper.updateObjectsInPersistence(txID,
                    appConfig.dcc.persistenceName, appConfig.dcc.persistenceKey, changedTrustElements);
        }
    } else {
        logger.error('Unable to acquire any data from DCC!', txID);
    }

    syncNumber += 1;
    logger.debug(`synchronizePersistentData complete: ${numInserts} inserts, ${numUpdates} updates`, txID);
}

// startSynchronization is an infinite loop that synchronizes trust list in persistent data with data from DCC source
//
// @param {string} txID - transaction ID (logging purposes only)
const startSynchronization = async (txID) => {
    syncInterval = process.env.DCC_SYNCHRONIZATION_INTERVAL || appConfig.dcc.syncInterval || -1;
    if (syncInterval <= 0) {
        logger.info('DCC synchronization disabled', txID);
        return;
    }

    logger.info(`DCC synchronization will occur every ${syncInterval} minutes`, txID);
    syncInterval *=  60 * 1000;
    while (syncInterval) {
        try {
            logger.debug('DCC synchronization taking place', txID);
            synchronizePersistentData(txID); // No need to wait

            logger.debug('DCC synchronization going to sleep', txID);
            await utils.sleep(syncInterval);
            logger.debug('DCC synchronization awake');
        }
        catch (err) {
            logger.error(`Error in DCC synchronization: ${JSON.stringify(err)}`);
            // Eat exception and get back to work
        }
    }
}

// getInfo gets pertinent information about DCC synchronization
//
// @param {string} txID - transaction ID (logging purposes only)
// @return {object} - DCC sync info
const getInfo = async (txID) => {
    logger.debug('Entering getInfo', txID);

    const trustListLength =
        await persistenceHelper.getNumberOfObjectsInPersistence(txID, appConfig.dcc.persistenceName);
    if (trustListLength)
        return {
            trustListLength,
            trustListSyncInterval: syncInterval,
            trustListSyncDuration: syncDuration,
            trustListSyncNumber: syncNumber,
            userInsertsNumber: numInserts,
            userDeletesNumber: numDeletes,
        };
    return { trustListLength: 0 };
}

// getTrusList gets the DCC trust list from persistent storage
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {object} query - query of format { name: value, ... } i.e. { "country" : "US" }
// @return {object} - { status, message, data } where:
//     status {number} - 200 indicates success, otherwise failure
//     message {string} - error message iff status indicates failure
//     data {object} - array of DCC objects iff status indicates success
const getTrustList = async (txID, query) => {
    logger.debug('Entering getTrustList', txID);

    const trustList = await persistenceHelper.readObjectsFromPersistence(txID, appConfig.dcc.persistenceName, query);
    if (trustList)
        return { status: 200, data: trustList };
    return { status: 500, message: 'Nothing to see here, move along'};
}

// addIssuer adds an issuer to the DCC trust list in persistent storage
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {object} issuer - DCC issuer
// @return {object} - { status, message, data } where:
//     status {number} - 200 indicates success, otherwise failure
//     message {string} - error message iff status indicates failure
//     data {object} - added DCC object iff status indicates success
const addIssuer = async (txID, issuer) => {
    logger.debug('Entering addIssuer', txID);

    const id = issuer[appConfig.dcc.persistenceKey];
    if (await persistenceHelper.readObjectFromPersistence(txID,
        appConfig.dcc.persistenceName, appConfig.dcc.persistenceKey, id))
        return { status: 409, message: 'DCC issuer already exists' };

    await persistenceHelper.writeObjectsToPersistence(txID, appConfig.dcc.persistenceName, [issuer]);
    numInserts += 1;
    return { status: 200, data: issuer };
}

// getIssuer gets an issuer from the DCC trust list in persistent storage
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {string} id - ID of DCC issuer
// @return {object} - { status, message, data } where:
//     status {number} - 200 indicates success, otherwise failure
//     message {string} - error message iff status indicates failure
//     data {object} - DCC object iff status indicates success
const getIssuer = async (txID, id) => {
    logger.debug('Entering getIssuer', txID);

    const issuer = await persistenceHelper.readObjectFromPersistence(txID,
        appConfig.dcc.persistenceName, appConfig.dcc.persistenceKey, id);
    if (issuer)
        return { status: 200, data: issuer };
    return { status: 404, message: 'DCC issuer not found'};
}

// deleteIssuer deletes an issuer from the DCC trust list in persistent storage
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {string} id - ID of DCC issuer
// @return {object} - { status, message, data } where:
//     status {number} - 200 indicates success, otherwise failure
//     message {string} - error message iff status indicates failure
//     data {object} - deleted DCC object iff status indicates success
const deleteIssuer = async (txID, id) => {
    logger.debug('Entering deleteIssuer', txID);

    if (!await persistenceHelper.readObjectFromPersistence(txID,
        appConfig.dcc.persistenceName, appConfig.dcc.persistenceKey, id))
        return { status: 404, message: 'DCC issuer not found' };

    const issuer = await persistenceHelper.deleteObjectFromPersistence(txID,
        appConfig.dcc.persistenceName, appConfig.dcc.persistenceKey, id);
    if (issuer) {
        numDeletes += 1;
        return { status: 200, data: issuer };
    }
    return { status: 500, message: 'Must be a glitch in the matrix'};
}

module.exports = {
    startSynchronization,
    getInfo,
    getTrustList,
    addIssuer,
    getIssuer,
    deleteIssuer,
}