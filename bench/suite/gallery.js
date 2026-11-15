/**
 * Gallery suite (gameplay § 14): the items a run passes (the simulation's mask), the gallery that keeps them.
 * - an element passed alive beside the runner: its item (a bike with its trail: an item of its own); an element hit (the test mode's shield) does not count;
 * - the Sentinel: its pass survived; the runner: GALLERY_RUNNER_DISTANCE run;
 * - LightLaneGallery without storage: unlock by mask, nothing twice, clear.
 */

const {load, Checker} = require('../lib/gameContext.js');

const SPEED = 15;

async function run() {
    const game       = load();
    const Simulation = game.get('LightLaneSimulation');
    const Tuning     = game.get('LightLaneTuning');
    const Gallery    = game.get('LightLaneGallery');
    const c          = new Checker();
    const step       = Tuning.STEP_SECONDS;
    const bit        = (item) => Simulation.galleryBit(item);
    const row        = (id) => ({id: id, mirror: false, offset: 0});

    // The rows played in the centre lane without an order, under the shield, up to `metres` past the start (or a stop).
    const play = (options, metres, stop = null) => {
        const sim = new Simulation().newRun({seed: 1, shield: true, speed: SPEED, ...options});
        const end = (sim.getZ() + metres);
        for (let i = 0; (i < 2000000) && (sim.getZ() < end) && (sim.getState() !== Simulation.GAME_OVER); i++) {
            sim.advance(step, []);
            sim.getEvents().clear();
            if ((stop !== null) && stop(sim)) {
                break;
            }
        }

        return sim;
    };
    const passed = (ids) => play({track: ids.map(row)}, (Tuning.FIRST_ROW + 60)).getPassed();

    // Beside the runner (left lane; C2: a stalker leaving the centre lane): each kind of element.
    const kinds = [['S1', 'hurdle'], ['S3', 'gate'], ['K1', 'block'], ['G1', 'gap'], ['E1', 'bike'], ['C2', 'bike']];
    for (const [id, item] of kinds) {
        c.check(id + ' passed beside: ' + item, (passed([id]) === bit(item)), 'mask ' + passed([id]));
    }
    const trail = play({tier: Tuning.TRAIL_TIER, track: [row('E1')]}, (Tuning.FIRST_ROW + 60)).getPassed();
    c.check('E1 passed beside from tier 7: the bike with its trail only', (trail === bit('bikeTrail')), 'mask ' + trail);
    const before = play({track: [row('S1')]}, (Tuning.FIRST_ROW - 5)).getPassed();
    c.check('not before its back is behind the runner', (before === 0), 'mask ' + before);
    c.check('an element hit (the shield) does not count', (passed(['S2']) === 0), 'mask ' + passed(['S2']));

    // The Sentinel: its first pass (tier 6) survived; the mask copied with the simulation (the robot's copies).
    let seen = false;
    const sentinel = play({tier: 6, track: [row('S6')]}, 20000, (sim) => {
        seen = (seen || sim.getSentinel().isActive());
        return (seen && !sim.getSentinel().isActive());
    });
    c.check('the Sentinel\'s pass survived: its item', (seen && ((sentinel.getPassed() & bit('sentinel')) !== 0)), 'seen ' + seen + ', mask ' + sentinel.getPassed());
    c.check('the mask copied with the simulation', (new Simulation().copyFrom(sentinel).getPassed() === sentinel.getPassed()));

    // The runner: at GALLERY_RUNNER_DISTANCE, not before.
    const distance = Tuning.GALLERY_RUNNER_DISTANCE;
    const short    = play({track: [row('S6')], speed: 35}, (distance - 50));
    const long     = play({track: [row('S6')], speed: 35}, (distance + 50));
    c.check('the runner: not before ' + distance + ' m', ((short.getPassed() & bit('runner')) === 0), Math.floor(short.getDistance()) + ' m');
    c.check('the runner: at ' + distance + ' m', ((long.getPassed() & bit('runner')) !== 0), Math.floor(long.getDistance()) + ' m');

    // The gallery without storage.
    const gallery = new Gallery().init(null);
    await gallery.load();
    c.check('gallery: empty at first', !gallery.hasAny());
    await gallery.unlock(bit('hurdle') | bit('bike'));
    await gallery.unlock(bit('hurdle'));
    const unlocked = Tuning.GALLERY_ITEMS.filter((item) => gallery.isUnlocked(item));
    c.check('gallery: the items of the mask, once', ((unlocked.join(',') === 'hurdle,bike') && gallery.hasAny()), unlocked.join(','));
    await gallery.clear();
    c.check('gallery: clear locks them again', !gallery.hasAny());

    return c.failures;
}

module.exports = {run};
