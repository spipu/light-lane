/**
 * Enemies suite (gameplay § 6, generation § 5): the whole simulation on written rows at a fixed speed.
 * - prowler: it reaches its meeting point when the runner does (± 2 m); met head-on: a shock; dodged: through; from the
 *   side: a stumble; jumped over (a motorbike's height): through when the jump is centred on it, a shock far too early;
 *   with the boots: through;
 * - stalker: announced at τ 2.4 s, moving at τ 1.6 s, on its new lane at τ 1.1 s (± 1 step); its lane of start free.
 */

const {load, Checker} = require('../lib/gameContext.js');

const SPEED = 15;

function run() {
    const game       = load();
    const Simulation = game.get('LightLaneSimulation');
    const Tuning     = game.get('LightLaneTuning');
    const c          = new Checker();
    const step       = Tuning.STEP_SECONDS;
    const row        = (id) => ({id: id, mirror: false, offset: 0});
    const zm         = Tuning.FIRST_ROW;

    /**
     * Plays the rows at SPEED: orders at a z ({z, order}), `watch(sim)` each step; returns the death and the stumbles.
     */
    const play = (rows, orders, watch = null, boots = false) => {
        const sim = new Simulation().newRun({seed: 1, track: rows.map(row), speed: SPEED});
        sim.getRunner().setBoots(boots);
        const out  = [];
        let next   = 0;
        let stumbles = 0;
        for (let i = 0; (i < 100000) && (sim.getState() !== Simulation.GAME_OVER) && (sim.getZ() < (zm + 30)); i++) {
            out.length = 0;
            if ((sim.getState() === Simulation.RUNNING) && (next < orders.length) && (sim.getZ() >= orders[next].z)) {
                out.push(orders[next++].order);
            }
            sim.advance(step, out);
            const events = sim.getEvents();
            for (let k = 0; k < events.getCount(); k++) {
                stumbles += ((events.get(k).type === 'stumble') ? 1 : 0);
            }
            events.clear();
            if (watch !== null) {
                watch(sim);
            }
        }

        return {death: sim.getDeath(), stumbles: stumbles};
    };
    const enemy = (sim) => sim.getTrack().getActive().find((e) => e.isEnemy());

    // Prowler in the centre (E2): its meeting.
    let front = null;
    play(['E2'], [{z: 40, order: 'left'}], (sim) => {
        const e = enemy(sim);
        if ((front === null) && (e !== undefined) && (sim.getZ() >= zm)) {
            front = e.getFront();
        }
    });
    c.check('prowler: at its meeting point when the runner is (± 2 m)', ((front !== null) && (Math.abs(front - zm) <= 2)), 'front ' + ((front !== null) ? front.toFixed(2) : null));
    c.check('prowler, met head-on: shock', (play(['E2'], []).death === 'shock'));
    c.check('prowler, dodged early: through', (play(['E2'], [{z: 40, order: 'left'}]).death === null));
    const side = play(['E2'], [{z: 58, order: 'left'}, {z: 59, order: 'right'}]);
    c.check('prowler, from its side: a stumble or a shock, never through', ((side.death !== null) || (side.stumbles > 0)), JSON.stringify(side));
    // A jump whose peak (half its time) is on the middle of the crossing: the runner meets the box (front at
    // zm + share × (zm − z)) at z = zm + (z0 − half depth) / (1 + share) and leaves it at zm + (z1 + half depth) / (1 + share).
    const spec   = Tuning.OBSTACLES.R;
    const share  = (1 + (Tuning.ENEMY_SPEED / SPEED));
    const middle = (zm + ((((spec.z0 - Tuning.RUNNER_HALF_DEPTH) + (spec.z1 + Tuning.RUNNER_HALF_DEPTH)) / 2) / share));
    const jumpAt = (time) => (middle - ((time / 2) * SPEED));
    c.check('prowler, a normal jump centred on it: through (a motorbike\'s height)', (play(['E2'], [{z: jumpAt(Tuning.JUMP_TIME), order: 'jump'}]).death === null));
    c.check('prowler, a normal jump far too early: shock', (play(['E2'], [{z: (jumpAt(Tuning.JUMP_TIME) - (Tuning.JUMP_TIME * SPEED / 2)), order: 'jump'}]).death === 'shock'));
    c.check('prowler, jumped over with the boots: through', (play(['E2'], [{z: jumpAt(Tuning.JUMP_TIME_BOOTS), order: 'jump'}], null, true).death === null));

    // Stalker (C2: in the centre, to the left).
    const taus = {warn: null, move: null, there: null};
    play(['C2'], [{z: 45, order: 'right'}], (sim) => {
        const e = enemy(sim);
        if (e === undefined) {
            return;
        }
        const tau = ((e.getZ() - sim.getZ()) / SPEED);
        if ((taus.warn === null) && e.isWarning()) {
            taus.warn = tau;
        }
        if ((taus.move === null) && (e.getX() !== 0)) {
            taus.move = tau;
        }
        if ((taus.there === null) && (e.getX() === -Tuning.LANE_WIDTH)) {
            taus.there = tau;
        }
    });
    const within = (tau, expected) => ((tau !== null) && (Math.abs(tau - expected) <= (step + 1e-9)));
    c.check('stalker: announced at τ 2.4 s', within(taus.warn, Tuning.STALKER_WARN), String(taus.warn));
    c.check('stalker: moving at τ 1.6 s', within(taus.move, Tuning.STALKER_MOVE), String(taus.move));
    c.check('stalker: on its new lane at τ 1.1 s', within(taus.there, (Tuning.STALKER_MOVE - Tuning.STALKER_MOVE_TIME)), String(taus.there));
    // Its heading while it moves across (left: negative), none before and after; the largest at the middle of the move.
    const headings = [];
    play(['C2'], [{z: 45, order: 'right'}], (sim) => {
        const e = enemy(sim);
        if (e !== undefined) {
            headings.push(e.getHeading());
        }
    });
    const steepest = Math.min(...headings);
    c.check('stalker: heads towards its new lane while moving, straight before and after', ((headings[0] === 0) && (headings[headings.length - 1] === 0) && (steepest < -10) && headings.every((h) => (h <= 0))), 'steepest ' + steepest.toFixed(1) + '°');

    // Its announce is an event, once (the sound of step 14).
    const announced = [];
    const sim       = new Simulation().newRun({seed: 1, track: [row('C2')], speed: SPEED});
    for (let i = 0; (i < 100000) && (sim.getZ() < zm); i++) {
        sim.advance(step, ['right'].slice(0, ((sim.getZ() > 45) && (sim.getRunner().getLane() === 0)) ? 1 : 0));
        const events = sim.getEvents();
        for (let k = 0; k < events.getCount(); k++) {
            if (events.get(k).type === 'announce') {
                announced.push(((events.get(k).entity.getZ() - sim.getZ()) / SPEED));
            }
        }
        events.clear();
    }
    c.check('stalker: one announce event, at τ 2.4 s', ((announced.length === 1) && within(announced[0], Tuning.STALKER_WARN)), announced.join(', '));
    c.check('stalker: its lane of start free at the meeting (stay in the centre)', (play(['C2'], []).death === null));
    c.check('stalker: its lane of arrival deadly (go left)', (play(['C2'], [{z: 50, order: 'left'}]).death === 'shock'));

    // The bikes' light trails (from TRAIL_TIER, gameplay § 6.3): rows written at tier 7, orders at z past the meeting point.
    const trailRun = (rows, orders) => {
        const sim   = new Simulation().newRun({seed: 1, tier: Tuning.TRAIL_TIER, track: rows.map(row), speed: SPEED});
        const meet  = (sim.getZ() + Tuning.FIRST_ROW);
        const out   = [];
        let next    = 0;
        for (let i = 0; (i < 100000) && (sim.getState() !== Simulation.GAME_OVER) && (sim.getZ() < (meet + 40)); i++) {
            out.length = 0;
            while ((sim.getState() === Simulation.RUNNING) && (next < orders.length) && (sim.getZ() >= (meet + orders[next].dz))) {
                out.push(orders[next++].order);
            }
            sim.advance(step, out);
            sim.getEvents().clear();
        }

        return sim.getDeath();
    };
    c.check('trail: a bike from tier 7 leaves one', (() => {
        const sim = new Simulation().newRun({seed: 1, tier: Tuning.TRAIL_TIER, track: [row('E2')], speed: SPEED});
        return sim.getTrack().getActive().some((e) => (e.isEnemy() && e.hasTrail()));
    })());
    const Entity   = game.get('LightLaneEntity');
    const recycled = new Entity().setObstacle('R', 0, 10).setTrail(true).setShare(0.5).reset().setCoin(0, 0.7, 20);
    c.check('trail: a recycled bike made a coin has none', !recycled.hasTrail());
    c.check('trail: none before tier 7', !new Simulation().newRun({seed: 1, track: [row('E2')], speed: SPEED}).getTrack().getActive().some((e) => e.hasTrail()));
    c.check('trail: back into a prowler\'s lane just behind it: shock', (trailRun(['E2'], [{dz: -20, order: 'left'}, {dz: 10, order: 'right'}]) === 'shock'));
    c.check('trail: back into its lane past the trail: through', (trailRun(['E2'], [{dz: -20, order: 'left'}, {dz: 25, order: 'right'}]) === null));
    // A stalker's trail (25 m, user request) has left the lane it left by the time the runner gets there; it is deadly on
    // its new lane, behind it.
    c.check('trail: staying on the lane a stalker left: through (its trail has left it)', (trailRun(['C2'], []) === null));
    c.check('trail: into a stalker\'s new lane just behind it: shock', (trailRun(['C2'], [{dz: 10, order: 'left'}]) === 'shock'));
    c.check('trail: into a stalker\'s new lane past its trail: through', (trailRun(['C2'], [{dz: 25, order: 'left'}]) === null));
    c.check('trail: away from a stalker\'s lanes early: through', (trailRun(['C2'], [{dz: -20, order: 'right'}]) === null));
    // Over a prowler's trail in the middle lane: from the right lane to the left one, both lane changes in a jump.
    const leap   = 10;
    const second = (leap + ((Tuning.JUMP_TIME * 0.17) * SPEED));
    c.check('trail: jumped over from one side to the other: through', (trailRun(['E2'], [{dz: -20, order: 'right'}, {dz: leap, order: 'jump'}, {dz: second, order: 'left'}, {dz: second, order: 'left'}]) === null));
    c.check('trail: the same crossing without a jump: shock', (trailRun(['E2'], [{dz: -20, order: 'right'}, {dz: second, order: 'left'}, {dz: second, order: 'left'}]) === 'shock'));

    return c.failures;
}

module.exports = {run};
