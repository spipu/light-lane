#!/usr/bin/env node
/**
 * Light Lane bench, run from the repository root, in Node, without a browser:
 *
 *   node bench/run.js                 every suite
 *   node bench/run.js --suite static  one suite
 *
 * Each suite (bench/suite/<name>.js) exports run() → its number of failures. Exits with 1 on a failure.
 */

const fs   = require('fs');
const path = require('path');

const SUITE_DIR = path.join(__dirname, 'suite');
const asked     = process.argv.includes('--suite') ? process.argv[process.argv.indexOf('--suite') + 1] : null;
const suites    = fs.readdirSync(SUITE_DIR).filter((file) => file.endsWith('.js')).map((file) => file.replace(/\.js$/, '')).sort()
    .filter((name) => ((asked === null) || (name === asked)));

if (suites.length === 0) {
    console.error('No suite ' + asked);
    process.exit(1);
}
let failures = 0;
for (const name of suites) {
    console.log('[' + name + ']');
    failures += require(path.join(SUITE_DIR, name + '.js')).run();
}
console.log((failures === 0) ? 'bench: all checks passed' : ('bench: ' + failures + ' check(s) failed'));
process.exit((failures === 0) ? 0 : 1);
