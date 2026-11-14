/**
 * Sentinel suite (gameplay § 7): a pass started on an empty track at a fixed speed, its three attacks written.
 * - strike: on the runner's lane, a shock; dodged by a lane change during the warning, nothing; jumping, a shock still;
 * - sweep low: a stumble standing, nothing jumping; sweep high: a stumble standing, nothing sliding;
 * - its pass: arrival, three attacks at 1.0, 3.4, 5.6 s of its presence, departure; never two sweeps of the same height
 *   in a row when drawn.
 */

const {load, Checker} = require('../lib/gameContext.js');

const SPEED = 15;

function run() {
    const game       = load();
    const Simulation = game.get('LightLaneSimulation');
    const Sentinel   = game.get('LightLaneSentinel');
    const Tuning     = game.get('LightLaneTuning');
    const c          = new Checker();
    const step       = Tuning.STEP_SECONDS;
    const first      = (Tuning.SENTINEL_ARRIVE + Tuning.SENTINEL_ATTACKS[0]);

    /**
     * A pass with its attacks set; orders at times since its start ({time, order}). Returns the death and stumbles.
     */
    const pass = (attacks, orders) => {
        const sim = new Simulation().newRun({seed: 1, track: [], speed: SPEED});
        while (sim.getState() !== Simulation.RUNNING) {
            sim.advance(step, []);
        }
        const sentinel = sim.getSentinel();
        sentinel.start(sim.getX());
        attacks.forEach((type, i) => {
            sentinel._attacks[i] = type;
        });
        const out = [];
        let next  = 0;
        let time  = 0;
        let stumbles = 0;
        while ((sim.getState() === Simulation.RUNNING) && sentinel.isActive() && (time < 20)) {
            out.length = 0;
            if ((next < orders.length) && (time >= orders[next].time)) {
                out.push(orders[next++].order);
            }
            sim.advance(step, out);
            time += step;
            const events = sim.getEvents();
            for (let k = 0; k < events.getCount(); k++) {
                stumbles += ((events.get(k).type === 'stumble') ? 1 : 0);
            }
            events.clear();
        }

        return {death: sim.getDeath(), stumbles: stumbles, over: !sentinel.isActive()};
    };
    const fire  = (first + Tuning.STRIKE_WARN);
    // The ray reaches the runner SWEEP_AHEAD / SWEEP_SPEED after its warning.
    const reach = (first + Tuning.SWEEP_WARN + (Tuning.SWEEP_AHEAD / Tuning.SWEEP_SPEED));
    const none  = [null, null, null];
    const only  = (type) => [type, null, null];

    c.check('a pass without attack: arrives, stays, leaves', pass(none, []).over);
    c.check('strike on the runner\'s lane: shock', (pass(only(Sentinel.STRIKE), []).death === 'shock'));
    c.check('strike dodged by a lane change during its warning: nothing', (pass(only(Sentinel.STRIKE), [{time: (fire - 0.5), order: 'left'}]).death === null));
    c.check('strike, jumping: shock (any height)', (pass(only(Sentinel.STRIKE), [{time: (fire - 0.2), order: 'jump'}]).death === 'shock'));
    const low = pass(only(Sentinel.SWEEP_LOW), []);
    c.check('sweep low, standing: a stumble', ((low.death === null) && (low.stumbles === 1)), JSON.stringify(low));
    const jumped = pass(only(Sentinel.SWEEP_LOW), [{time: (reach - (Tuning.JUMP_TIME / 2)), order: 'jump'}]);
    c.check('sweep low, jumped: nothing', ((jumped.death === null) && (jumped.stumbles === 0)), JSON.stringify(jumped));
    const high = pass(only(Sentinel.SWEEP_HIGH), []);
    c.check('sweep high, standing: a stumble', ((high.death === null) && (high.stumbles === 1)), JSON.stringify(high));
    const slid = pass(only(Sentinel.SWEEP_HIGH), [{time: (reach - (Tuning.SLIDE_TIME / 2)), order: 'slide'}]);
    c.check('sweep high, slid under: nothing', ((slid.death === null) && (slid.stumbles === 0)), JSON.stringify(slid));
    const twice = pass([Sentinel.SWEEP_LOW, Sentinel.SWEEP_LOW, null], []);
    c.check('two sweeps a pass: two stumbles, the second while fragile kills', (twice.death === 'trip'), JSON.stringify(twice));

    // Drawn attacks: strike about half the time, never two sweeps of the same height in a row.
    const sentinel = new Sentinel().reset(7);
    let strikes   = 0;
    let total     = 0;
    let repeats   = 0;
    let lastSweep = null;
    for (let k = 0; k < 2000; k++) {
        sentinel.start(0);
        for (const type of sentinel._attacks) {
            total++;
            if (type === Sentinel.STRIKE) {
                strikes++;
                continue;
            }
            repeats  += ((type === lastSweep) ? 1 : 0);
            lastSweep = type;
        }
    }
    c.check('drawn: strikes about ' + Tuning.STRIKE_CHANCE, (Math.abs((strikes / total) - Tuning.STRIKE_CHANCE) < 0.03), (strikes / total).toFixed(3));
    c.check('drawn: never two sweeps of the same height in a row', (repeats === 0), repeats + ' repeated');

    return c.failures;
}

module.exports = {run};
