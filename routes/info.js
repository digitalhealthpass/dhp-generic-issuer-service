/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */

const express = require('express');
const check = require('../controllers/info');
 
const router = express.Router();
 
router.get('/', check.release);
 
module.exports = router;
