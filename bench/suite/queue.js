/**
 * Queue suite (gameplay § 3.6): an order that cannot run waits ORDER_KEEP_TIME, the latest replaces the older one, a
 * waiting order runs as soon as it can.
 */

const {load, Checker} = require('../lib/gameContext.js');

function run() {
    const game    = load();
    const Runner  = game.get('LightLaneRunner');
    const Events  = game.get('LightLaneEvents');
    const Tuning  = game.get('LightLaneTuning');
    const Sampler = game.get('LightLaneCommandSampler');
    const c       = new Checker();
    const step    = Tuning.STEP_SECONDS;
    const world   = {laneExists: (lane) => (Math.abs(lane) <= 1), standingCutsGate: () => false};
    const events  = new Events();
    // Either side of ORDER_KEEP_TIME (0.20 s, tech § 8): kept, dropped.
    const KEPT    = 0.15;
    const DROPPED = 0.25;
    const steps   = (seconds, r) => {
        for (let i = 0; i < Math.round(seconds / step); i++) {
            r.step(step, null, events);
        }
    };

    // A second lane order during a change: it waits, then runs (5 lanes: two lefts end two lanes away, which the
    // first order alone or an order dropped would not).
    const wide = {laneExists: (lane) => (Math.abs(lane) <= 2), standingCutsGate: () => false};
    let r = new Runner(wide);
    r.step(step, [Sampler.LEFT], events);
    r.step(step, [Sampler.LEFT], events);
    steps(Tuning.LANE_CHANGE_TIME - (2 * step), r);
    const firstLane = r.getLane();
    steps(Tuning.LANE_CHANGE_TIME + 0.05, r);
    c.check('lane order during a change: run after it', ((firstLane === -1) && (r.getLane() === -2)), 'lanes ' + firstLane + ', ' + r.getLane());

    // The latest replaces the older one (5 lanes: neither order is refused).
    r = new Runner(wide);
    r.step(step, [Sampler.LEFT], events);
    r.step(step, [Sampler.RIGHT], events);
    r.step(step, [Sampler.LEFT], events);
    steps(Tuning.LANE_CHANGE_TIME * 2 + 0.05, r);
    c.check('latest order replaces the older', (r.getLane() === -2), 'lane ' + r.getLane());

    // A jump asked in the air shortly before landing: it runs on landing.
    r = new Runner(world);
    r.step(step, [Sampler.JUMP], events);
    steps(Tuning.JUMP_TIME - KEPT, r);
    r.step(step, [Sampler.JUMP], events);
    steps(KEPT + 0.02, r);
    c.check('jump asked ' + KEPT + ' s before landing: jumps again', r.isJumping());

    // Asked too early: dropped after ORDER_KEEP_TIME.
    r = new Runner(world);
    r.step(step, [Sampler.JUMP], events);
    steps(Tuning.JUMP_TIME - DROPPED, r);
    r.step(step, [Sampler.JUMP], events);
    steps(DROPPED + 0.05, r);
    c.check('jump asked ' + DROPPED + ' s before landing: dropped', !r.isJumping());

    // A slide in the air is never queued: it is a fast drop.
    r = new Runner(world);
    r.step(step, [Sampler.JUMP], events);
    steps(0.2, r);
    const y = r.getY();
    r.step(step, [Sampler.SLIDE], events);
    c.check('slide in the air: fast drop at once', (r.getY() < y));

    return c.failures;
}

module.exports = {run};
