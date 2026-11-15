/**
 * Collision suite (gameplay § 4, § 5): the whole simulation on written rows (the test mode's track), orders given at
 * a z, as the browser plays them; each case ends on the expected outcome: through, stumble, or the death expected.
 */

const {load, Checker} = require('../lib/gameContext.js');

function run() {
    const game       = load();
    const Simulation = game.get('LightLaneSimulation');
    const Tuning     = game.get('LightLaneTuning');
    const c          = new Checker();
    const step       = Tuning.STEP_SECONDS;
    const row        = (id) => ({id: id, mirror: false, offset: 0});

    /**
     * Plays a run on the rows until zEnd or its end: orders at z ({z, order}), returns what happened.
     */
    const play = (rows, orders, zEnd, speed = null) => {
        const sim = new Simulation().newRun({seed: 1, track: rows.map(row), speed: speed});
        const out = [];
        let next  = 0;
        let stumbles = 0;
        let maxStep  = 200000;
        while ((sim.getState() !== Simulation.GAME_OVER) && (sim.getZ() < zEnd) && (maxStep-- > 0)) {
            out.length = 0;
            if ((sim.getState() === Simulation.RUNNING) && (next < orders.length) && (sim.getZ() >= orders[next].z)) {
                out.push(orders[next++].order);
            }
            sim.advance(step, out);
            const events = sim.getEvents();
            for (let i = 0; i < events.getCount(); i++) {
                if (events.get(i).type === 'stumble') {
                    stumbles++;
                }
            }
            events.clear();
        }
        return {death: sim.getDeath(), stumbles: stumbles, z: sim.getZ(), coins: sim.getScore().getCoins(), sim: sim};
    };
    const front = (sim, kind) => sim.getTrack().getActive().find((e) => (e.getKind() === kind));

    // Hurdle in the centre (S2, its front at 60 m): run into it, jump in its window, jump too early, land on it.
    c.check('hurdle, no order: shock', (play(['S2'], [], 80).death === 'shock'));
    c.check('hurdle, jump in its window: through', (play(['S2'], [{z: 56, order: 'jump'}], 80).death === null));
    c.check('hurdle, jump far too early: shock', (play(['S2'], [{z: 50, order: 'jump'}], 80).death === 'shock'));
    const landed = play(['S2'], [{z: 53.3, order: 'jump'}], 80);
    c.check('hurdle, coming down on it: stumble, alive', ((landed.death === null) && (landed.stumbles === 1)), 'death ' + landed.death + ', stumbles ' + landed.stumbles);

    // The hurdle's jump window at the lowest and the highest speeds (gameplay § 4): a jump 0.50 to 0.15 s before the
    // contact (runner's box front on the hurdle's box front) clears it; 0.65 s or 0.05 s before, a shock.
    const contact = ((60 + Tuning.OBSTACLES.H.z0) - Tuning.RUNNER_HALF_DEPTH);
    for (const speed of [Tuning.START_SPEED_FROM, Tuning.SPEED_MAX]) {
        const before  = (lead) => play(['S2'], [{z: (contact - (lead * speed)), order: 'jump'}], 80, speed).death;
        const through = [0.50, 0.40, 0.30, 0.20, 0.15].map(before);
        const shocks  = [0.65, 0.05].map(before);
        c.check('hurdle at ' + speed + ' m/s: jumps 0.50 → 0.15 s before the contact clear it', through.every((death) => (death === null)), through.join(','));
        c.check('hurdle at ' + speed + ' m/s: 0.65 s and 0.05 s before, a shock', shocks.every((death) => (death === 'shock')), shocks.join(','));
    }

    // Gate in the centre (S4): standing, jumping, sliding; a slide ending under the beam goes on.
    c.check('gate, no order: shock', (play(['S4'], [], 80).death === 'shock'));
    c.check('gate, jump: shock', (play(['S4'], [{z: 56, order: 'jump'}], 80).death === 'shock'));
    c.check('gate, slide: through', (play(['S4'], [{z: 56, order: 'slide'}], 80).death === null));
    const kept = play(['S4'], [{z: 52.4, order: 'slide'}], 60.2);
    c.check('gate, slide ending under the beam: still sliding', (kept.sim.getRunner().isSliding() && (kept.death === null)), 'z ' + kept.z.toFixed(2));
    c.check('gate, that slide: through', (play(['S4'], [{z: 52.4, order: 'slide'}], 80).death === null));

    // Block on the left (K1): into its side during a lane change: stumble, back to the centre; twice: trip.
    const side = play(['K1'], [{z: 61, order: 'left'}], 80);
    c.check('block, into its side: stumble, back on lane 0', ((side.death === null) && (side.stumbles === 1) && (side.sim.getRunner().getLane() === 0)));
    const twoSides = (() => {
        const sim = new Simulation().newRun({seed: 1, track: [row('K1'), row('K1')]});
        const out = [];
        const blocks = () => sim.getTrack().getActive().filter((e) => (e.getKind() === 'block'));
        const targets = blocks().map((b) => (b.getZ() + 1));
        let next = 0;
        for (let i = 0; (i < 100000) && (sim.getState() !== Simulation.GAME_OVER) && (sim.getZ() < 200); i++) {
            out.length = 0;
            if ((sim.getState() === Simulation.RUNNING) && (next < targets.length) && (sim.getZ() >= targets[next])) {
                out.push('left');
                next++;
            }
            sim.advance(step, out);
            sim.getEvents().clear();
        }
        return sim.getDeath();
    })();
    c.check('block, its side twice within the fragile time: trip', (twoSides === 'trip'), String(twoSides));
    // The same block from the side twice (it stays solid): stumble, then trip while fragile.
    const sameTwice = (() => {
        const sim   = new Simulation().newRun({seed: 1, track: [row('L2')]});
        const block = sim.getTrack().getActive().find((e) => (e.getKind() === 'block'));
        const out   = [];
        const tries = [block.getZ() + 1, block.getZ() + 4];
        let next    = 0;
        let stumbles = 0;
        for (let i = 0; (i < 100000) && (sim.getState() !== Simulation.GAME_OVER) && (sim.getZ() < (block.getZ() + 20)); i++) {
            out.length = 0;
            if ((sim.getState() === Simulation.RUNNING) && (next < tries.length) && (sim.getZ() >= tries[next])) {
                out.push('left');
                next++;
            }
            sim.advance(step, out);
            const events = sim.getEvents();
            for (let k = 0; k < events.getCount(); k++) {
                stumbles += ((events.get(k).type === 'stumble') ? 1 : 0);
            }
            events.clear();
        }
        return {death: sim.getDeath(), stumbles: stumbles, lane: sim.getRunner().getLane()};
    })();
    c.check('block, the same side twice: never through it, trip the second time', ((sameTwice.death === 'trip') && (sameTwice.stumbles === 1)), JSON.stringify(sameTwice));
    c.check('block, run into its front (K3: a block on lane 0): shock', (play(['K3'], [], 80).death === 'shock'));

    // Gap in the centre (G2: its hole aligned at a tile's start + 3.5 m): fall, or jump over it.
    const gapRun = play(['G2'], [], 100);
    c.check('gap, no order: fall', (gapRun.death === 'fall'));
    const gap = front(new Simulation().newRun({seed: 1, track: [row('G2')]}), 'gap');
    c.check('gap, its hole at a tile\'s start + 3.5 m', (((gap.getZ() % Tuning.TILE_LENGTH) + Tuning.TILE_LENGTH) % Tuning.TILE_LENGTH === 3.5), 'z ' + gap.getZ());
    c.check('gap, jump over it: through', (play(['G2'], [{z: gap.getZ() - 4, order: 'jump'}], 100).death === null));

    // Coins: the rest row's line on lane 0 is picked up running straight.
    const coins = play(['S6'], [], 100);
    c.check('coins: the rest line picked up', (coins.coins >= Tuning.COIN_LINE_MIN), coins.coins + ' coins');
    c.check('coins: ' + Tuning.COIN_POINTS + ' points each', (coins.sim.getScore().getScore() === Math.floor(coins.sim.getDistance() + (coins.coins * Tuning.COIN_POINTS))));

    // Shield (test mode): a death counted, the run goes on.
    const shielded = new Simulation().newRun({seed: 1, track: [row('S2')], shield: true});
    const none = [];
    for (let i = 0; (i < 100000) && (shielded.getZ() < 80); i++) {
        shielded.advance(step, none);
        shielded.getEvents().clear();
    }
    c.check('shield: the death counted, still running', ((shielded.getShieldDeaths() === 1) && (shielded.getState() === Simulation.RUNNING)));

    // One collision a step (gameplay § 5.1): an element and a sweep met on the same step make one stumble, not a trip.
    const twice = new Simulation().newRun({seed: 1, track: [row('S6')]});
    twice._stumbled = false;
    const firstKills  = twice._stumble(true);
    const secondKills = twice._stumble(false);
    let stumbles = 0;
    for (let k = 0; k < twice.getEvents().getCount(); k++) {
        stumbles += ((twice.getEvents().get(k).type === 'stumble') ? 1 : 0);
    }
    c.check('one collision a step: two stumbles on one step make one, no trip', (!firstKills && !secondKills && (twice.getDeath() === null) && (stumbles === 1)), stumbles + ' stumble event(s)');

    // Dying, then over: 1.0 s for a shock.
    const over = play(['S2'], [], 80);
    c.check('shock: the game is over after dying', (over.sim.getState() === Simulation.GAME_OVER));

    return c.failures;
}

module.exports = {run};
