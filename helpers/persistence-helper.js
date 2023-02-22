/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */
/* eslint-disable no-restricted-syntax */

const Logger = require('../config/logger');

const logger = new Logger('persistence-helper');

// persistence-helper is a wrapper around persistence APIs and is meant to simplify switching over from in-memory
// persistence to database since all changes should be isolated to this file.  Note that these helper routines do
// not generate exceptions, which is a future consideration when switching from in-memory to database.

// In-memory persistentStorage looks like this:
// {
//     "dcc-issuers": [],
//     "vci-issuers": [],
//      ::
// }
const persistentStorage = {};

// getNumberOfObjectsInPersistence gets the number of objects in persistemt storage
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {string} storageName - name of persistent storage type
// @return {number} - number of objects or -1 if storage type does not exist
const getNumberOfObjectsInPersistence = async (txID, storageName) => {
    logger.debug(`Entering getNumberOfObjectsInPersistence(${storageName})`, txID);

    if (persistentStorage[storageName]) {
        const dataArray = persistentStorage[storageName];
        const { length } = dataArray;
        logger.debug(`Storage ${storageName} exists, returning ${length}`, txID);
        return length;
    }
    logger.debug(`Storage ${storageName} does not exist, returning -1`, txID);
    return -1;
}

// readObjectFromPersistence returns one object from persistent storage where keyName===keyValue
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {string} storageName - name of persistent storage type
// @param {string} keyName - name of object key
// @param {string} keyValue - name of object value
// @return {object} - matching object or null if it does not exist
const readObjectFromPersistence = async (txID, storageName, keyName, keyValue) => {
    logger.debug(`Entering readObjectFromPersistence(${storageName})`, txID);

    if (persistentStorage[storageName]) {
        let dataObject = null;

        const matchingObjects = persistentStorage[storageName].filter(obj => {
            return obj[keyName] === keyValue;
        });

        if (!matchingObjects || !matchingObjects.length) {
            // Not found
        } else if (matchingObjects.length === 1) {
            [dataObject] = matchingObjects;
        } else {
            logger.error(`Multiple objects for ${keyName}=${keyValue}!`, txID);
        }

        return dataObject;
    }
    return null;
}

// readObjectsFromPersistence returns array of objects from persistent storage that match query
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {string} storageName - name of persistent storage type
// @param {object} query - query of format { key : value, ... }
// @return {object} - array of matching objects or empty array if no matches exist
const readObjectsFromPersistence = async (txID, storageName, query) => {
    logger.debug(`Entering readObjectsFromPersistence(${storageName})`, txID);

    if (persistentStorage[storageName]) {
        let dataArray = [];

        if (query && Object.keys(query).length > 0) {
            logger.debug(`Returning filtered array for ${storageName}`, txID);

            let filteredArray = persistentStorage[storageName];
            for (const [key, value] of Object.entries(query)) {
                logger.debug(`Starting with ${filteredArray.length} elements`, txID);
                filteredArray = filteredArray.filter(obj => {
                    return obj[key] === value;
                });
                logger.debug(`Filtering on ${key}:${value} produced ${filteredArray.length} elements`, txID);
            }
            dataArray = dataArray.concat(filteredArray);
        } else {
            logger.debug(`Returning entire array for ${storageName}`, txID);
            dataArray = dataArray.concat(persistentStorage[storageName]);
        }

        return dataArray;
    }
    return null;
}

// writeObjectsToPersistence writes array of objects to persistent storage
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {string} storageName - name of persistent storage type
// @param {object} - array of objects
const writeObjectsToPersistence = async (txID, storageName, array) => {
    logger.debug(`Entering writeObjectsToPersistence(${storageName})`, txID);

    let currentArray;
    if (!persistentStorage[storageName]) {
        logger.debug(`Creating new array for ${storageName}`, txID);
        currentArray = [];
    } else {
        logger.debug(`Appending to existing array for ${storageName}`, txID);
        currentArray = persistentStorage[storageName];
    }

    const newArray = currentArray.concat(array);
    persistentStorage[storageName] = newArray;
}

// updateObjectsInPersistence updates array of objects in persistent storage
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {string} storageName - name of persistent storage type
// @param {string} keyName - name of object key
// @param {object} - array of objects
const updateObjectsInPersistence = async (txID, storageName, keyName, array) => {
    logger.debug(`Entering updateObjectsInPersistence(${storageName})`, txID);

    if (persistentStorage[storageName] && Array.isArray(array)) {
        for (let i = 0; i < array.length; i += 1) {
            const element = array[i];
            const key = element[keyName];

            const index = persistentStorage[storageName].findIndex(item => item[keyName] === key);

            if (index === -1) {
                logger.error(`Cannot update object that doesn't exist: ${storageName}.${keyName}`, txID);
            } else {
                logger.debug(`Updating element in ${storageName} at index ${index}`, txID);
                persistentStorage[storageName][index] = element;
            }
        }
    }
}

// deleteObjectFromPersistence deletes one object from storageName where keyName===keyValue
//
// @param {string} txID - transaction ID (logging purposes only)
// @param {string} storageName - name of persistent storage type
// @param {string} keyName - name of object key
// @param {string} keyValue - name of object value
// @return {object} - deleted object or null if it does not exist
const deleteObjectFromPersistence = async (txID, storageName, keyName, keyValue) => {
    logger.debug(`Entering deleteObjectFromPersistence(${storageName})`, txID);

    if (persistentStorage[storageName]) {
        const index = persistentStorage[storageName].findIndex(item => item[keyName] === keyValue);

        if (index === -1) {
            logger.error(`Cannot delete object that doesn't exist: ${storageName}.${keyName}`, txID);
        } else {
            logger.debug(`Deleting element in ${storageName} at index ${index}`, txID);
            const deletedObject = persistentStorage[storageName][index];
            persistentStorage[storageName].splice(index, 1);
            return deletedObject;
        }
    }
    return null;
}

module.exports = {
    getNumberOfObjectsInPersistence,
    readObjectFromPersistence,
    readObjectsFromPersistence,
    writeObjectsToPersistence,
    updateObjectsInPersistence,
    deleteObjectFromPersistence,
}