/**
 * Seed suite (gameplay § 1, tech § 8): two runs of the whole simulation with the same seed and the same orders give the
 * same stream (a fingerprint of every element generated and of the runner's path); another seed another stream.
 */

const {load, Checker} = require('../lib/gameContext.js');

const LENGTH = 2500;

function run() {
    const game       = load();
    const Simulation = game.get('LightLaneSimulation');
    const Tuning     = game.get('LightLaneTuning');
    const c          = new Checker();

    // A run under the test mode's shield (no death), a lane change every 2 s: its fingerprint.
    const fingerprint = (seed) => {
        const sim  = new Simulation().newRun({seed: seed, shield: true});
        const seen = new Map();
        const path = [];
        let hash   = 0;
        for (let i = 0; (i < 400000) && (sim.getZ() < LENGTH); i++) {
            const order = (((i % 240) === 0) ? [(((i / 240) % 2) === 0) ? 'left' : 'right'] : []);
            sim.advance(Tuning.STEP_SECONDS, order);
            sim.getEvents().clear();
            for (const entity of sim.getTrack().getActive()) {
                seen.set(entity.getSerial(), entity.getKind() + ':' + entity.getCode() + ':' + entity.getLane() + ':' + entity.getZ().toFixed(3));
            }
            if ((i % 120) === 0) {
                path.push(sim.getX().toFixed(3) + '/' + sim.getZ().toFixed(3));
            }
        }
        for (const text of [...seen.values(), ...path]) {
            for (let k = 0; k < text.length; k++) {
                hash = (((hash * 31) + text.charCodeAt(k)) >>> 0);
            }
        }

        return {hash: hash, count: seen.size};
    };
    const a = fingerprint(42);
    const b = fingerprint(42);
    const d = fingerprint(43);
    c.check('same seed, same orders: same stream', ((a.hash === b.hash) && (a.count === b.count)), a.count + ' elements, ' + a.hash.toString(16));
    c.check('another seed: another stream', (a.hash !== d.hash));

    return c.failures;
}

module.exports = {run};
