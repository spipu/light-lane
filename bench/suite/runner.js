/**
 * Runner suite (gameplay § 3): the jump's parabola and length, the fast drop into a slide, the lane change's time and
 * end, the slide's time, the refused lane, the stumble's slowdown and fragile state — LightLaneRunner alone, with a
 * world of 3 lanes and no gate.
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
    const close   = (a, b, e = 1e-6) => (Math.abs(a - b) <= e);

    // Jump: peak H at T / 2, back on the ground at T.
    let r = new Runner(world);
    r.step(step, [Sampler.JUMP], events);
    let peak = 0;
    let steps = 1;
    while (r.isJumping() && (steps < 1000)) {
        peak = Math.max(peak, r.getY());
        r.step(step, null, events);
        steps++;
    }
    c.check('jump: peak ' + Tuning.JUMP_HEIGHT + ' m', close(peak, Tuning.JUMP_HEIGHT, 1e-3), peak.toFixed(4));
    c.check('jump: lasts ' + Tuning.JUMP_TIME + ' s', close(steps * step, Tuning.JUMP_TIME, step + 1e-9), (steps * step).toFixed(4));

    // Fast drop: down at FAST_DROP_SPEED, then a slide.
    r = new Runner(world);
    r.step(step, [Sampler.JUMP], events);
    for (let i = 0; i < 30; i++) {
        r.step(step, null, events);
    }
    const height = r.getY();
    r.step(step, [Sampler.SLIDE], events);
    c.check('fast drop: falls at ' + Tuning.FAST_DROP_SPEED + ' m/s', close(height - r.getY(), Tuning.FAST_DROP_SPEED * step, 1e-9));
    while (r.isJumping()) {
        r.step(step, null, events);
    }
    c.check('fast drop: a slide on landing', (r.isSliding() && (r.getY() === 0)));

    // Slide: SLIDE_TIME, low box.
    r = new Runner(world);
    r.step(step, [Sampler.SLIDE], events);
    c.check('slide: low box', (r.getHeight() === Tuning.RUNNER_SLIDE_HEIGHT));
    steps = 1;
    while (r.isSliding() && (steps < 1000)) {
        r.step(step, null, events);
        steps++;
    }
    c.check('slide: lasts ' + Tuning.SLIDE_TIME + ' s', close(steps * step, Tuning.SLIDE_TIME, step + 1e-9), (steps * step).toFixed(4));

    // Lane change: LANE_CHANGE_TIME, ends on the lane's centre, halfway at half time (smoothstep).
    r = new Runner(world);
    r.step(step, [Sampler.RIGHT], events);
    const half = Math.round((Tuning.LANE_CHANGE_TIME / 2) / step);
    for (let i = 1; i < half; i++) {
        r.step(step, null, events);
    }
    const s = Math.min(1, ((half * step) / Tuning.LANE_CHANGE_TIME));
    c.check('lane change: smoothstep (3s² − 2s³) on the way', close(r.getX(), Tuning.LANE_WIDTH * ((3 * s * s) - (2 * s * s * s)), 1e-9), r.getX().toFixed(4));
    for (let i = 0; i < half; i++) {
        r.step(step, null, events);
    }
    c.check('lane change: on lane +1 after ' + Tuning.LANE_CHANGE_TIME + ' s', ((r.getX() === Tuning.LANE_WIDTH) && (r.getLaneSide() === 0) && (r.getLane() === 1)));

    // A lane that does not exist: refused, no move.
    events.clear();
    r.step(step, [Sampler.RIGHT], events);
    c.check('missing lane: refused', ((r.getLane() === 1) && (events.getCount() === 1) && (events.get(0).type === 'refuse')));

    // Stumble: slower, then back; fragile; a second one kills.
    r = new Runner(world);
    c.check('stumble: survives the first', (r.stumble(false) === false));
    c.check('stumble: slowed to ' + Tuning.STUMBLE_SLOW, (r.getSpeedFactor() === Tuning.STUMBLE_SLOW));
    c.check('stumble: fragile', r.isFragile());
    c.check('stumble: the second one while fragile kills', (r.stumble(false) === true));
    r = new Runner(world);
    r.stumble(false);
    const toBack = Math.round((Tuning.STUMBLE_SLOW_TIME + Tuning.STUMBLE_RAMP_TIME) / step) + 1;
    for (let i = 0; i < toBack; i++) {
        r.step(step, null, events);
    }
    c.check('stumble: full speed after ' + (Tuning.STUMBLE_SLOW_TIME + Tuning.STUMBLE_RAMP_TIME) + ' s', (r.getSpeedFactor() === 1));
    for (let i = 0; i < Math.round(Tuning.FRAGILE_TIME / step); i++) {
        r.step(step, null, events);
    }
    c.check('stumble: not fragile after ' + Tuning.FRAGILE_TIME + ' s', !r.isFragile());

    // From the side during a lane change: back to the lane of origin.
    r = new Runner(world);
    r.step(step, [Sampler.LEFT], events);
    r.step(step, null, events);
    r.stumble(true);
    for (let i = 0; i < 40; i++) {
        r.step(step, null, events);
    }
    c.check('side stumble: back on the lane of origin', ((r.getLane() === 0) && (r.getX() === 0)), 'x ' + r.getX());

    return c.failures;
}

module.exports = {run};
