/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */

const { expect } = require('chai');

const somethingHelper = require('../../helpers/something-helper');

describe('getAllSomethings()', () => {
    it('should return an empty array', async () => {
        const query = await somethingHelper.getAllSomethings(1);

        expect(query).to.be.an('array').that.is.empty;
    });
});
