/**
 * Generation suite (generation § 1, plan step 8's provisional generator): the track depends on the seed only — the same
 * seed gives the same rows, another seed others —, rows stay on the 0.5 m grid and a gap's hole starts at its tile's
 * start + holeFrom, generated ahead of the runner up to GENERATE_AHEAD, retired behind it. The speed by tier, up to
 * 35 m/s at tier 21. The full generation suite
 * (tiers, sections, fairness) comes with plan step 10.
 */

const {load, Checker} = require('../lib/gameContext.js');

function run() {
    const game      = load();
    const Generator = game.get('LightLaneTrackGenerator');
    const Entity    = game.get('LightLaneEntity');
    const Tuning    = game.get('LightLaneTuning');
    const c         = new Checker();
    const LENGTH    = 3000;

    // The whole track to LENGTH, written as text: one entry an element.
    const track = (seed) => {
        const generator = new Generator().reset(seed, 0, null);
        const seen      = new Map();
        for (let z = 0; z < LENGTH; z += 5) {
            generator.update(z);
            for (const entity of generator.getActive()) {
                seen.set(entity.serial, entity.kind + ':' + entity.code + ':' + entity.lane + ':' + entity.z.toFixed(2) + ':' + entity.y.toFixed(2));
            }
        }

        return [...seen.values()];
    };

    // The speed by tier (gameplay § 9.1): the table to tier 7, then +1 m/s every 1 000 m, 35 m/s at tier 21, no further.
    const Simulation = game.get('LightLaneSimulation');
    c.check('tier 7: 4 200 m, 21.5 m/s', ((Simulation.tierAt(4200) === 7) && (Simulation.tierSpeed(7) === 21.5)));
    c.check('tier 8: 5 200 m, 22.5 m/s', ((Simulation.tierAt(5200) === 8) && (Simulation.tierSpeed(8) === 22.5)));
    c.check('tier 21: 18 200 m, 35 m/s', ((Simulation.tierAt(18200) === 21) && (Simulation.tierSpeed(21) === 35)));
    c.check('past 18 200 m: still tier 21 at 35 m/s', ((Simulation.tierAt(100000) === 21) && (Simulation.tierSpeed(Simulation.tierAt(100000)) === 35)));
    c.check('one tier every 1 000 m after tier 7', [9, 10, 15, 20].every((tier) => (Simulation.tierStart(tier) === (4200 + ((tier - 7) * 1000))) && (Simulation.tierAt(Simulation.tierStart(tier) - 1) === (tier - 1))));

    const first = track(7);
    c.check('a track of ' + LENGTH + ' m holds elements', (first.length > 100), first.length + ' elements');
    c.check('same seed: same track', (track(7).join('|') === first.join('|')));
    c.check('another seed: another track', (track(8).join('|') !== first.join('|')));

    const generator = new Generator().reset(3, 0, null);
    let offGrid     = 0;
    let badHoles    = 0;
    let ahead       = true;
    let behind      = true;
    for (let z = 0; z < LENGTH; z += 7) {
        generator.update(z);
        for (const entity of generator.getActive()) {
            if (entity.kind === Entity.COIN) {
                continue;
            }
            const cells = (entity.z / Tuning.CELL);
            offGrid    += ((Math.abs(cells - Math.round(cells)) > 1e-6) ? 1 : 0);
            if (entity.kind === Entity.GAP) {
                const into = (((entity.z % Tuning.TILE_LENGTH) + Tuning.TILE_LENGTH) % Tuning.TILE_LENGTH);
                badHoles  += ((Math.abs(into - Tuning.OBSTACLES[entity.code].holeFrom) > 1e-6) ? 1 : 0);
            }
            behind = (behind && (entity.getEnd() >= (z - Tuning.RETIRE_BEHIND)));
        }
        ahead = (ahead && generator.getActive().some((entity) => (entity.z >= (z + (Tuning.GENERATE_AHEAD / 2)))));
    }
    c.check('obstacles on the 0.5 m grid', (offGrid === 0), offGrid + ' off it');
    c.check('a gap\'s hole at its tile\'s start + holeFrom', (badHoles === 0), badHoles + ' misplaced');
    c.check('nothing kept past RETIRE_BEHIND', behind);
    c.check('elements generated at least GENERATE_AHEAD / 2 ahead', ahead);

    return c.failures;
}

module.exports = {run};
