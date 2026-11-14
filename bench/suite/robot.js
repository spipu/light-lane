/**
 * Robot suite (generation § 8.3, tech § 8.1): the robot plays the real simulation, tier locked, with its latency, under
 * the test mode's shield (a death is counted, the run goes on): 0 death expected; each death prints its seed, tier and z
 * for its analysis (a passage humanly impossible → the generator is fixed; otherwise the robot).
 *
 * Length: LIGHT_LANE_ROBOT_METERS metres per seed and tier (300 by default, a few minutes for the whole suite); the
 * full campaign of the spec (5 seeds × 1 000 rows) is about 30 000 m: LIGHT_LANE_ROBOT_METERS=30000.
 */

const {load, Checker} = require('../lib/gameContext.js');

const SEEDS  = [1, 2, 3, 4, 5];
const TIERS  = [0, 1, 2, 3, 4, 5, 6, 7, 21];
const METERS = Number(process.env.LIGHT_LANE_ROBOT_METERS ?? 300);

function run() {
    const game       = load();
    const Simulation = game.get('LightLaneSimulation');
    const Robot      = game.get('LightLaneRobot');
    const Tuning     = game.get('LightLaneTuning');
    const c          = new Checker();

    for (const tier of TIERS) {
        const deaths = [];
        for (const seed of SEEDS) {
            const sim   = new Simulation().newRun({seed: seed, tier: tier, locked: true, shield: true});
            const robot = new Robot().reset();
            const out   = [];
            const start = sim.getZ();
            let counted = 0;
            while (sim.getZ() < (start + METERS)) {
                out.length = 0;
                robot.update(sim, out);
                sim.advance(Tuning.STEP_SECONDS, out);
                sim.getEvents().clear();
                if (sim.getShieldDeaths() !== counted) {
                    counted = sim.getShieldDeaths();
                    deaths.push('seed ' + seed + ' z ' + sim.getZ().toFixed(1));
                }
            }
        }
        c.check('tier ' + tier + ': ' + SEEDS.length + ' seeds × ' + METERS + ' m, no death', (deaths.length === 0), deaths.join(', '));
    }

    return c.failures;
}

module.exports = {run};
