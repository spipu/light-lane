/**
 * Gallery suite (gameplay § 14): the items a run passes (the simulation's mask), the gallery that keeps them.
 * - an element passed alive beside the runner: its item (a bike with its trail: an item of its own); an element hit (the test mode's shield) does not count;
 * - the Sentinel: its pass survived; the runner: GALLERY_RUNNER_DISTANCE run;
 * - LightLaneGallery without storage: unlock by mask, nothing twice, clear;
 * - with a store (a stand-in for AppDatabase): read at load, the record written ({item, date} keyed by the item), a write
 *   that fails leaves the item locked and a later call writes it; the base's upgrade from version 1 adds the gallery's
 *   store only.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const {load, Checker} = require('../lib/gameContext.js');

const WEBSITE_DIR = path.resolve(__dirname, '..', '..', 'website');

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
    c.check('a gap fallen into (the shield) does not count', (passed(['G2']) === 0), 'mask ' + passed(['G2']));

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

    // With a store: AppDatabase's calls the gallery makes, on a map; `failing` makes its writes throw.
    const store = {records: new Map(), failing: false};
    const database = {
        getAll: async () => [...store.records.values()],
        putMulti: async (records) => {
            if (store.failing) {
                throw new Error('quota');
            }
            records.forEach(({record}) => store.records.set(record.item, record));
        },
        clear: async () => store.records.clear()
    };
    store.records.set('gate', {item: 'gate', date: '2026-01-01T00:00:00.000Z'});
    const stored = new Gallery().init(database);
    await stored.load();
    c.check('store: the items read at load', (stored.isUnlocked('gate') && !stored.isUnlocked('hurdle')));
    await stored.unlock(bit('hurdle'));
    const written = store.records.get('hurdle');
    c.check('store: the record written, keyed by its item', ((written !== undefined) && (written.item === 'hurdle') && (typeof written.date === 'string') && stored.isUnlocked('hurdle')));
    store.failing = true;
    const failed = await stored.unlock(bit('bike')).then(() => false, () => true);
    c.check('store: a write that fails leaves the item locked', (failed && !stored.isUnlocked('bike') && !store.records.has('bike')));
    store.failing = false;
    await stored.unlock(bit('bike'));
    c.check('store: a later call writes it', (stored.isUnlocked('bike') && store.records.has('bike')));

    // The base's upgrades (tech § 6): from version 1 the gallery's store only; from nothing, all three.
    const ctx = vm.createContext({Object, Array, Error, Promise});
    for (const file of ['js/webapp/appDatabaseSchema.js', 'js/webapp/appDatabaseUpgrade.js', 'js/lightLane/lightLaneDatabaseSchema.js']) {
        vm.runInContext(fs.readFileSync(path.join(WEBSITE_DIR, file), 'utf8'), ctx, {filename: file});
    }
    const created = async (fromVersion) => {
        const names = [];
        const db    = {createObjectStore: (name) => {
            names.push(name);
            return {createIndex: () => null};
        }};
        const schema = vm.runInContext('LightLaneDatabaseSchema.build()', ctx);
        await schema.upgrade(new (vm.runInContext('AppDatabaseUpgrade', ctx))(db, null), fromVersion);

        return names.join(',');
    };
    c.check('upgrade: from version 1, the gallery\'s store only', ((await created(1)) === 'gallery'), await created(1));
    c.check('upgrade: from nothing, the three stores', ((await created(0)) === 'setting,score,gallery'), await created(0));

    return c.failures;
}

module.exports = {run};
