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

const logger = new Logger('vci-helper');

// Getting list of VCI trusted issuers is two-step process:
// 1) Get list of participating users
// 2) Get list of keys for each participating user
//
// Primary key for persistence is url, and within keys[] uniqueness is based on kid

// Global variables used by GET /info API
let syncInterval;
let syncDuration;
let syncNumber = 0;
const participatingIssuersErrors = []; // Object is issuerName, lastError, numErrors
let numInserts = 0;
let numUpdates = 0;
let numDeletes = 0;

// addParticipatingIssuersErrors adds errors to global array
//
// @param {object} a - array of errors of format { name, error }
function addParticipatingIssuersErrors(a) {
    for (let i = 0; i < a.length; i += 1) {
        const index = participatingIssuersErrors.findIndex(item => item.issuerName === a[i].name);
        if (index === -1) {
            const newIssuer = { issuerName: a[i].name, lastError: a[i].error, numErrors: 1};
            participatingIssuersErrors.push(newIssuer);
        } else {
            participatingIssuersErrors[index].numErrors += 1;
        }
    }
}

// isEqual compares two VCI objects
// NOTE: Because VCI does have an embedded object (keys[]), we need "deepish" compare
//
// @param {object} vci1 - VCI object #1
// @param {object} vci2 - VCI object #2
// @return {boolean} - true if VCI objects are equal, false otherwise
function isEqual(vci1, vci2) {
    const keys1 = Object.keys(vci1);
    const keys2 = Object.keys(vci2);
    if (keys1.length !== keys2.length) return false;
    for (const key of keys1) {
        if (key === 'keys') {
            // Hoo boy, here we go... keys is an array
            if (!vci2.keys) return false;
            const a1 = vci1.keys;
            const a2 = vci2.keys;
            if (!Array.isArray(a1) || !Array.isArray(a2)) return false;
            if (a1.length !== a2.length) return false;

            // Easy cases done, now the fun part
            for (let i = 0; i < a1.length; i+= 1) {
                const { kid } = a1[i];
                const matches = a2.filter(obj => {
                    return obj.kid === kid;
                });
                if (!matches || !matches.length || matches.length > 1) return false;
            }
        }
        else if (vci1[key] !== vci2[key]) return false;
    }
    return true;
}

// getTrustListFromParticipatingIssuers builds a list of trusted issuers from all participating issuers
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {object} issuers - array of participating issuers
// @return {object} - array of trusted issuers
const getTrustListFromParticipatingIssuers = async (txID, issuers) => {
    logger.debug('Entering getTrustListFromParticipatingIssuers', txID);

    const newTrustList = [];
    let numKeys = 0;
    let numGoodIssuers = 0;
    const badIssuers = [];
    for (let i = 0; i < issuers.length; i += 1) {
        const vciApi = axios.create({
            baseURL: issuers[i].iss,
            timeout: appConfig.vci.timeout,
            headers: {
                Accept: 'application/json'
            }
        });
    
        let { retries } = appConfig.vci;
        while (retries >= 0) {
            try {
                // logger.debug(`Calling ${issuers[i].iss}${appConfig.vci.issuerUriSuffix}`, txID);
                const apiRes = await vciApi.get(appConfig.vci.issuerUriSuffix);
                if (apiRes.data.keys) {
                    newTrustList.push({
                        name: issuers[i].name,
                        url: issuers[i].iss,
                        keys: apiRes.data.keys
                    });
                    numKeys += apiRes.data.keys.length;
                    numGoodIssuers += 1;
                } else
                    logger.warn(`VCI data from ${issuers[i].name} includes zero keys`, txID);
                retries = -1; // break while loop
            } catch (err) {
                if (err.code === 'ECONNABORTED') {
                    if (retries <= 0) {
                        badIssuers.push({ name: issuers[i].name, error: err.code });
                        logger.warn(`Received ${err.code} from ${issuers[i].name}, no retries remaining`, txID)
                    } else
                        logger.debug(
                            `Received ${err.code} from ${issuers[i].name} and attempting retry, ${retries} remaining`,
                            txID
                        );
                    retries -= 1;
                } else {
                    logger.warn(`Received ${err.code} from ${issuers[i].name}, aborting retries`, txID);
                    badIssuers.push({ name: issuers[i].name, error: err.code });
                    retries = -1; // break while loop
                }
            }
        }
    }

    addParticipatingIssuersErrors(badIssuers);
    const badIssuersNames = badIssuers.map(a => a.name);
    logger.debug(`Called ${numGoodIssuers} VCI sources successfully with ${numKeys} returned keys`, txID);
    logger.debug(`Called ${badIssuers.length} VCI sources unsuccessfully: [${badIssuersNames}]`, txID);
    return newTrustList;
}

// getDataFromSource gets list of trusted issuers from configured VCI source
//
// @param {string} txID - transaction ID (logging purposes only)
// @return {object} - array of trusted issuers or null if error occurred
const getDataFromSource = async (txID) => {
    logger.debug('Entering getDataFromSource', txID);

    const vciApi = axios.create({
        baseURL: appConfig.vci.baseUrl,
        timeout: appConfig.vci.timeout,
        headers: {
            Accept: '*'
        }
    });

    const timeStart = Date.now();
    let { retries } = appConfig.vci;
    while (retries >= 0) {
        try {
            logger.debug('Calling VCI', txID);
            const apiRes = await vciApi.get();
            if (Array.isArray(apiRes.data.participating_issuers)) {
                const participatingIssuers = apiRes.data.participating_issuers;
                logger.debug(`VCI returned ${participatingIssuers.length} participating issuers`, txID);

                const trustList = await getTrustListFromParticipatingIssuers(txID, participatingIssuers);
                syncDuration = Date.now() - timeStart;
                logger.debug(`getDataFromSource took ${syncDuration}ms`, txID);
                return trustList;
            }

            logger.error(`Received unknown object (${typeof apiRes.data.participating_issuers})`, txID);
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

// synchronizePersistentData gets trust list from VCI source and then persists it through creates/updates
//
// @param {string} txID - transaction ID (logging purposes only)
const synchronizePersistentData = async (txID) => {
    logger.debug('Entering synchronizePersistentData', txID);

    const newTrustList = await getDataFromSource(txID);
    const currentTrustList = await persistenceHelper.readObjectsFromPersistence(txID, appConfig.vci.persistenceName);
    logger.debug(`Current length ${currentTrustList?.length}, new length ${newTrustList?.length}`, txID);

    let numInserts = 0;
    let numUpdates = 0;

    if (newTrustList) {
        if (!currentTrustList) {
            // Easy peesy, write 'em all
            await persistenceHelper.writeObjectsToPersistence(txID, appConfig.vci.persistenceName, newTrustList);
            numInserts = newTrustList.length;
        } else {
            // Little tougher, gotta figure out what's new and what's changed
            const newTrustElements = [];
            const changedTrustElements = [];
            for (let i = 0; i < newTrustList.length; i += 1) {
                const newTrustElement = newTrustList[i];
                const currentTrustListMatches = currentTrustList.filter(obj => {
                    return obj[appConfig.vci.persistenceKey] === newTrustElement[appConfig.vci.persistenceKey];
                });
                if (!currentTrustListMatches || !currentTrustListMatches.length) {
                    // New element, insert!
                    newTrustElements.push(newTrustElement);
                    numInserts += 1;
                    logger.debug(`Inserting issuer with PK ${newTrustElement[appConfig.vci.persistenceKey]}`, txID);
                } else if (currentTrustListMatches.length > 1) {
                    logger.error(`Multiple elements with same key ${newTrustElement[appConfig.vci.persistenceKey]}!`,
                        txID);
                } else if (!isEqual(newTrustElement, currentTrustListMatches[0])) {
                    // Existing element, update!
                    changedTrustElements.push(newTrustElement);
                    numUpdates += 1;
                    logger.debug(`Updating issuer with PK ${newTrustElement[appConfig.vci.persistenceKey]}`, txID);
                }
            }

            if (newTrustElements.length)
                await persistenceHelper.writeObjectsToPersistence(txID,
                    appConfig.vci.persistenceName, newTrustElements);
            if (changedTrustElements.length)
                await persistenceHelper.updateObjectsInPersistence(txID,
                    appConfig.vci.persistenceName, appConfig.vci.persistenceKey, changedTrustElements);
        }
    } else {
        logger.error('Unable to acquire any data from VCI!', txID);
    }

    syncNumber += 1;
    logger.debug(`synchronizePersistentData complete: ${numInserts} inserts, ${numUpdates} updates`, txID);
}

// startSynchronization is an infinite loop that synchronizes trust list in persistent data with data from VCI source
//
// @param {string} txID - transaction ID (logging purposes only)
const startSynchronization = async (txID) => {
    syncInterval = process.env.VCI_SYNCHRONIZATION_INTERVAL || appConfig.vci.syncInterval || -1;
    if (syncInterval <= 0) {
        logger.info('VCI synchronization disabled', txID);
        return;
    }

    logger.info(`VCI synchronization will occur every ${syncInterval} minutes`, txID);
    syncInterval *=  60 * 1000;
    while (syncInterval) {
        try {
            logger.debug('VCI synchronization taking place', txID);
            synchronizePersistentData(txID); // No need to wait


            logger.debug('VCI synchronization going to sleep', txID);
            await utils.sleep(syncInterval);
            logger.debug('VCI synchronization awake', txID);
        }
        catch (err) {
            logger.error(`Error in VCI synchronization: ${JSON.stringify(err)}`, txID);
            // Eat exception and get back to work
        }
    }
}

// getInfo gets pertinent information about VCI synchronization
//
// @param {string} txID - transaction ID (logging purposes only)
// @return {object} - VCI sync info
const getInfo = async (txID) => {
    logger.debug('Entering getInfo', txID);

    const trustListLength =
        await persistenceHelper.getNumberOfObjectsInPersistence(txID, appConfig.vci.persistenceName);
    if (trustListLength)
        return {
            trustListLength,
            trustListSyncInterval: syncInterval,
            trustListSyncDuration: syncDuration,
            trustListSyncNumber: syncNumber,
            trustListErrors: participatingIssuersErrors,
            userInsertsNumber: numInserts,
            userUpdatesNumber: numUpdates,
            userDeletesNumber: numDeletes,
        };
    return { trustListLength: 0 };
}

// getTrusList gets the VCI trust list from persistent storage
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {query} - query of format { name: value, ... } i.e. { "country" : "US" }
// @return {object} - { status, message, data } where:
//     status {number} - 200 indicates success, otherwise failure
//     message {string} - error message iff status indicates failure
//     data {object} - array of VCI objects iff status indicates success
const getTrustList = async (txID, query) => {
    logger.debug('Entering getTrustList', txID);

    const trustList = await persistenceHelper.readObjectsFromPersistence(txID, appConfig.vci.persistenceName, query);
    if (trustList)
        return { status: 200, data: trustList };
    return { status: 400, message: 'Nothing to see here, move along'};
}

// addIssuer adds an issuer to the VCI trust list in persistent storage
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {object} issuer - VCI issuer
// @return {object} - { status, message, data } where:
//     status {number} - 200 indicates success, otherwise failure
//     message {string} - error message iff status indicates failure
//     data {object} - added VCI object iff status indicates success
const addIssuer = async (txID, issuer) => {
    logger.debug('Entering addIssuer', txID);

    const id = issuer[appConfig.vci.persistenceKey];
    if (await persistenceHelper.readObjectFromPersistence(txID,
        appConfig.vci.persistenceName, appConfig.vci.persistenceKey, id))
        return { status: 409, message: 'VCI issuer already exists' };

    await persistenceHelper.writeObjectsToPersistence(txID, appConfig.vci.persistenceName, [issuer]);
    numInserts += 1;
    return { status: 200, data: issuer };
}

// updateIssuer updates an issuer in the VCI trust list in persistent storage
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {object} issuer - VCI issuer
// @return {object} - { status, message, data } where:
//     status {number} - 200 indicates success, otherwise failure
//     message {string} - error message iff status indicates failure
//     data {object} - updated VCI object iff status indicates success
const updateIssuer = async (txID, issuer) => {
    logger.debug('Entering updateIssuer', txID);

    const id = issuer[appConfig.vci.persistenceKey];
    if (!await persistenceHelper.readObjectFromPersistence(txID,
        appConfig.vci.persistenceName, appConfig.vci.persistenceKey, id))
        return { status: 404, message: 'VCI issuer not found' };

    await persistenceHelper.updateObjectsInPersistence(txID,
        appConfig.vci.persistenceName, appConfig.vci.persistenceKey, [issuer]);
    numUpdates += 1;
    return { status: 200, data: issuer };
}

// getIssuer gets an issuer from the VCI trust list in persistent storage
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {string} id - ID of VCI issuer
// @return {object} - { status, message, data } where:
//     status {number} - 200 indicates success, otherwise failure
//     message {string} - error message iff status indicates failure
//     data {object} - VCI object iff status indicates success
const getIssuer = async (txID, id) => {
    logger.debug('Entering getIssuer', txID);

    const issuer = await persistenceHelper.readObjectFromPersistence(txID,
        appConfig.vci.persistenceName, appConfig.vci.persistenceKey, id);
    if (issuer)
        return { status: 200, data: issuer };
    return { status: 404, message: 'VCI issuer not found'};
}

// deleteIssuer deletes an issuer from the VCI trust list in persistent storage
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {string} id - ID of VCI issuer
// @return {object} - { status, message, data } where:
//     status {number} - 200 indicates success, otherwise failure
//     message {string} - error message iff status indicates failure
//     data {object} - deleted VCI object iff status indicates success
const deleteIssuer = async (txID, id) => {
    logger.debug('Entering deleteIssuer', txID);

    if (!await persistenceHelper.readObjectFromPersistence(txID,
        appConfig.vci.persistenceName, appConfig.vci.persistenceKey, id))
        return { status: 404, message: 'VCI issuer not found' };

    const issuer = await persistenceHelper.deleteObjectFromPersistence(txID,
        appConfig.vci.persistenceName, appConfig.vci.persistenceKey, id);
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
    updateIssuer,
    getIssuer,
    deleteIssuer,
}