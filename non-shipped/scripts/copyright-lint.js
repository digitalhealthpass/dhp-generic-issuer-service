/**
 * (c) Copyright Merative US L.P. and others 2020-2022
 *
 *  SPDX-Licence-Identifier: Apache 2.0
 */

/**
 * Used to detect when copyright is...
 * 1.  Missing from files
 * 2.  Not updated to the current year
 *
 * Usage:  node copyright-lint.js file1 file2 ... fileN
 */

const fs = require('fs');

const CURRENT_YEAR = new Date().getFullYear();

// Format example: (c) Copyright Merative US L.P. 2020
const COPYRIGHT_SINGLE_YEAR = new RegExp(
    `(\\(c\\))\\s+(Copyright)\\s+(Merative)\\s+(L.P.)\\s+(${CURRENT_YEAR})\\s*`,
    'g'
);

// Format example: (c) Copyright Merative US L.P. 2020, 2022
const COPYRIGHT_MULTI_YEAR = new RegExp(
    `(\\(c\\))\\s+(Copyright)\\s+(Merative)\\s+(L.P.)\\s+(\\d{4},)\\s+(${CURRENT_YEAR})\\s*`,
    'g'
);

// Format example: (c) Copyright Merative US L.P. 2020-2022
const COPYRIGHT_YEAR_RANGE = new RegExp(
    `(\\(c\\))\\s+(Copyright)\\s+(Merative US)\\s+(L.P. and others)\\s+(\\d{4}-)\(${CURRENT_YEAR})\\s*`,
    'g'
);

// Args index 2 and later should be paths to files
if (process.argv.length < 3) {
    console.error('Usage: node copyright-lint.js file1 file2 ... fileN');
    process.exit(-1);
}
const files = process.argv.splice(2);

// Test each file and get a list of the failed copyright checks
const badFiles = files.reduce(function(accum, file) {
    const fileContents = fs.readFileSync(file, 'utf8');
    const results = [fileContents.match(COPYRIGHT_MULTI_YEAR),
        fileContents.match(COPYRIGHT_SINGLE_YEAR),
        fileContents.match(COPYRIGHT_YEAR_RANGE)];
    //   console.log(`File: ${file}\nDEBUG: ${results}`);
    if (!results[0] && !results[1] && !results[2]) {
        accum.push(file);
    }
    return accum;
}, []);

if (badFiles.length > 0) {
    console.error('COPYRIGHT ISSUE: Verify copyright is present and includes current year in following files...');
    console.error(badFiles.join('\n'));
    process.exit(-1);
} else {
    process.exit(0);
}
