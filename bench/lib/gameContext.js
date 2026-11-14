/**
 * The simulation's classes loaded in a vm context, in the browser's order (read from js/libBootstrap.json), without
 * the engine, the DOM or the loader: what the suites drive. AppInputSwipe is reduced to its direction constants (read at load by
 * LightLaneCommandSampler).
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const WEBSITE_DIR = path.resolve(__dirname, '..', '..', 'website');
const SOURCES     = [
    'js/lightLane/lightLaneTuning.js',
    'js/lightLane/game/lightLaneCommandSampler.js',
    'js/lightLane/game/lightLaneRandom.js',
    'js/lightLane/game/lightLaneDifficulty.js',
    'js/lightLane/game/lightLanePatterns.js',
    'js/lightLane/game/lightLaneEntity.js',
    'js/lightLane/game/lightLaneEvents.js',
    'js/lightLane/game/lightLaneRunScore.js',
    'js/lightLane/game/lightLaneRunner.js',
    'js/lightLane/game/lightLaneCollision.js',
    'js/lightLane/game/lightLaneOccupancy.js',
    'js/lightLane/game/lightLaneTrackGenerator.js',
    'js/lightLane/game/lightLaneSimulation.js',
];

/**
 * @returns {object} the context, its classes readable by name (ctx.get('LightLaneSimulation'))
 */
// The sources in the browser's order: each must be declared in js/libBootstrap.json, loaded in its order.
function ordered() {
    const declared = Object.values(JSON.parse(fs.readFileSync(path.join(WEBSITE_DIR, 'js/libBootstrap.json'), 'utf8')).files).flat()
        .map((file) => file.replace(/^\//, ''));
    const missing  = SOURCES.filter((file) => !declared.includes(file));
    if (missing.length > 0) {
        throw new Error('gameContext - not in libBootstrap.json: ' + missing.join(', '));
    }

    return [...SOURCES].sort((a, b) => (declared.indexOf(a) - declared.indexOf(b)));
}

function load() {
    const ctx = vm.createContext({
        console, Math, Object, Array, Map, Set, Error, Number, String, Date, JSON, Infinity, Uint8Array, Int32Array,
        AppInputSwipe: {LEFT: 'left', RIGHT: 'right', UP: 'up', DOWN: 'down'}
    });
    for (const file of ordered()) {
        vm.runInContext(fs.readFileSync(path.join(WEBSITE_DIR, file), 'utf8'), ctx, {filename: file});
    }

    return {get: (name) => vm.runInContext(name, ctx)};
}

/**
 * Checks printed as the other suites do; failures counted.
 */
class Checker {
    constructor() {
        this.failures = 0;
    }

    check(label, ok, detail = '') {
        if (!ok) {
            this.failures++;
        }
        console.log(((ok) ? '  ok   ' : '  FAIL ') + label + ((detail !== '') ? (' (' + detail + ')') : ''));
    }
}

module.exports = {load, Checker, SOURCES};
