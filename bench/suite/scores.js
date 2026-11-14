/**
 * Scores suite (gameplay § 12, tech § 6): LightLaneScores read in a vm over a fake database (the AppDatabase calls it
 * makes) and over memory (no storage): the 10 best kept, best first, the older first between equal scores, a run out of
 * them refused (null), its rank given, the surplus dropped, an old record without `time` kept as it is, a failure to
 * drop the surplus not losing the rank.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const {Checker} = require('../lib/gameContext.js');

const WEBSITE_DIR = path.resolve(__dirname, '..', '..', 'website');
const SOURCES     = ['js/lightLane/lightLaneDatabaseSchema.js', 'js/lightLane/lightLaneScores.js'];

// The AppDatabase calls LightLaneScores makes, over an array; deleteMulti fails on demand.
class FakeDatabase {
    constructor() {
        this.records    = [];
        this.failDelete = false;
        this._id        = 0;
    }

    async getAll() {
        return this.records.map((record) => ({...record}));
    }

    async insert(store, record) {
        const id = ++this._id;
        this.records.push({...record, id: id});

        return id;
    }

    async deleteMulti(keys) {
        if (this.failDelete) {
            throw new Error('delete failed');
        }
        const ids    = new Set(keys.map((key) => key.key));
        this.records = this.records.filter((record) => !ids.has(record.id));
    }

    async clear() {
        this.records = [];
    }
}

// new Date() of the scores: one second later at each call, so the order of the runs is the order of the calls.
function context() {
    let tick = 0;
    class FakeDate {
        constructor() {
            this._time = Date.UTC(2026, 0, 1) + ((tick++) * 1000);
        }

        toISOString() {
            return new Date(this._time).toISOString();
        }
    }
    const ctx = vm.createContext({console: {warn: () => {}}, Math, Object, Array, Set, Error, Promise, Date: FakeDate, AppDatabaseSchema: class {}});
    for (const file of SOURCES) {
        vm.runInContext(fs.readFileSync(path.join(WEBSITE_DIR, file), 'utf8'), ctx, {filename: file});
    }

    return vm.runInContext('LightLaneScores', ctx);
}

const run = (score) => ({score: score, coins: 0, distance: 0, time: 1});

async function suite() {
    const c = new Checker();

    for (const [label, database] of [['database', new FakeDatabase()], ['memory', null]]) {
        const Scores = context();
        const scores = new Scores().init(database);
        const ranks  = [];
        for (const score of [50, 80, 20, 80, 10, 90, 30, 40, 60, 70]) {
            ranks.push((await scores.add(run(score))).rank);
        }
        let list = await scores.list();
        c.check(label + ': 10 runs kept, best first', (list.map((entry) => entry.score).join(',') === '90,80,80,70,60,50,40,30,20,10'));
        c.check(label + ': ranks given as they came', (ranks.join(',') === '1,1,3,2,5,1,5,5,4,4'), ranks.join(','));
        c.check(label + ': equal scores, the older first', (list[1].id < list[2].id));
        c.check(label + ': a run equal to the 10th does not enter', ((await scores.add(run(10))) === null));
        c.check(label + ': a run under the 10th does not enter', ((await scores.add(run(5))) === null));
        const entry = await scores.add(run(85));
        list        = await scores.list();
        c.check(label + ': a new 2nd ranked and the 10th dropped', ((entry.rank === 2) && (list.length === 10) && (list[9].score === 20)));
        if (database !== null) {
            c.check(label + ': the surplus is gone from the store', (database.records.length === 10));
        }
        await scores.clear();
        c.check(label + ': cleared', ((await scores.list()).length === 0));
    }

    // An old record (saved before the time played was kept) stays as it is.
    const database = new FakeDatabase();
    database.records.push({id: 100, score: 40, coins: 2, distance: 300, date: '2025-12-31T00:00:00.000Z'});
    const scores = new (context())().init(database);
    const list   = await scores.list();
    c.check('an old record without time: listed, time absent', ((list.length === 1) && (list[0].time === undefined)));

    // The surplus cannot be dropped: the run is saved and keeps its rank.
    for (let i = 0; i < 10; i++) {
        await scores.add(run(100 + i));
    }
    database.failDelete = true;
    const entry = await scores.add(run(200));
    c.check('surplus not dropped: the run keeps its rank', ((entry !== null) && (entry.rank === 1)));
    c.check('surplus not dropped: the list still gives 10', ((await scores.list()).length === 10));

    return c.failures;
}

module.exports = {run: suite};
