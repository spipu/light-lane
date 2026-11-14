/**
 * Generation suite (generation § 1 to § 4, § 6, § 7.1, § 8, § 9; plan step 10, tiers 0 to 2):
 * - the difficulty: the start's rise from 10 to 15 m/s over 500 m, the tiers' speeds, 35 m/s at tier 21;
 * - the tier locked (§ 8.3), 5 seeds × 1 000 rows for tiers 0 to 2: the 0.5 m grid, the gaps' holes, no element on a
 *   lane that does not exist, the warning zones kept clear, the sections' rules, no repetition of the last Ids, few
 *   rows left empty by the fairness check, no coin on a block or a gap;
 * - the frequencies of the patterns against the probabilities really offered at each row (chi-square, p > 0.01);
 * - a run from the start: the first encounters, the forced first section of 5 lanes, the first bonus.
 */

const {load, Checker} = require('../lib/gameContext.js');

const SEEDS = [1, 2, 3, 4, 5];
const ROWS  = 1000;

function run() {
    const game       = load();
    const Generator  = game.get('LightLaneTrackGenerator');
    const Difficulty = game.get('LightLaneDifficulty');
    const Simulation = game.get('LightLaneSimulation');
    const Entity     = game.get('LightLaneEntity');
    const Tuning     = game.get('LightLaneTuning');
    const Patterns   = game.get('LightLanePatterns');
    const c          = new Checker();
    const near       = (a, b, eps = 1e-6) => (Math.abs(a - b) < eps);

    // --- The difficulty (gameplay § 9.1) ---
    c.check('start: 10 m/s at 0 m, 15 m/s at 500 m', (near(Difficulty.targetSpeed(0), 10) && near(Difficulty.targetSpeed(500), 15)));
    const rise = [0, 100, 200, 300, 400, 499].map((d) => Difficulty.startSpeed(d));
    c.check('start: rising, quicker at first', rise.every((v, i) => ((i === 0) || (v > rise[i - 1]))) && ((rise[1] - rise[0]) > (rise[5] - rise[4])), rise.map((v) => v.toFixed(2)).join(' '));
    c.check('tiers 1 to 7: 15, 16.1, 17.2, 18.3, 19.4, 20.5, 21.5 m/s', [15, 16.1, 17.2, 18.3, 19.4, 20.5, 21.5].every((v, i) => near(Difficulty.tierSpeed(i + 1), v)));
    c.check('tier 8: 5 200 m, 22.5 m/s', ((Difficulty.tierAt(5200) === 8) && near(Difficulty.tierSpeed(8), 22.5)));
    c.check('tier 21: 18 200 m, 35 m/s; no further', ((Difficulty.tierAt(18200) === 21) && (Difficulty.tierSpeed(21) === 35) && (Difficulty.tierAt(100000) === 21)));
    c.check('one tier every 1 000 m after tier 7', [9, 10, 15, 20].every((tier) => (Difficulty.tierStart(tier) === (4200 + ((tier - 7) * 1000))) && (Difficulty.tierAt(Difficulty.tierStart(tier) - 1) === (tier - 1))));
    const sim = new Simulation().newRun({seed: 1, shield: true});
    const speeds = {};
    for (let i = 0; (i < 200000) && (sim.getZ() < 800); i++) {
        sim.advance(Tuning.STEP_SECONDS, []);
        sim.getEvents().clear();
        for (const mark of [250, 600]) {
            if ((speeds[mark] === undefined) && (sim.getZ() >= mark)) {
                speeds[mark] = sim.getSpeed();
            }
        }
    }
    c.check('the run: the start\'s rise at 250 m, 15 m/s at 600 m', (near(speeds[250], Difficulty.startSpeed(250), 0.02) && near(speeds[600], 15, 1e-9)), speeds[250].toFixed(3) + ', ' + speeds[600]);

    // --- Locked tiers 0 to 2 ---
    for (const tier of [0, 1, 2]) {
        const stats = lockedRun(Generator, Entity, Tuning, Patterns, tier);
        c.check('tier ' + tier + ': elements on the 0.5 m grid', (stats.offGrid === 0), stats.offGrid + ' off it');
        c.check('tier ' + tier + ': gaps\' holes at their tile\'s start + holeFrom', (stats.badHoles === 0), stats.badHoles + ' misplaced');
        c.check('tier ' + tier + ': no element on a missing lane', (stats.offTrack === 0), stats.offTrack + ' off the track');
        c.check('tier ' + tier + ': warning zones and first sections kept clear', (stats.inWarning === 0), stats.inWarning + ' inside');
        c.check('tier ' + tier + ': sections on whole tiles, lengths in range', (stats.badSections === 0), stats.badSections + ' wrong of ' + stats.sections);
        c.check('tier ' + tier + ': ' + ((tier < 2) ? 'always 3 lanes' : 'sections of 5 lanes, never two in a row'), ((tier < 2) ? (stats.fives === 0) : ((stats.fives > 0) && (stats.twoFives === 0))), stats.fives + ' of 5 lanes, ' + stats.twoFives + ' in a row');
        c.check('tier ' + tier + ': no Id among the last ones', (stats.repeats === 0), stats.repeats + ' repeated');
        c.check('tier ' + tier + ': rows left empty by the check < 2 %', (stats.empty < (0.02 * stats.rows)), stats.empty + ' of ' + stats.rows);
        c.check('tier ' + tier + ': no coin on a block or a gap', (stats.badCoins === 0), stats.badCoins + ' misplaced');
        c.check('tier ' + tier + ': only the catalogue of the tier', (stats.outOfTier === 0), stats.outOfTier + ' above it');
        const chi = chiSquare(stats.observed, stats.expected);
        c.check('tier ' + tier + ': pattern frequencies as offered (chi-square, p > 0.01)', (chi.p > 0.01), 'chi² ' + chi.chi2.toFixed(1) + ', df ' + chi.df + ', p ' + chi.p.toFixed(3));
    }

    // --- A run from the start (generation § 3, § 6, § 7.1) ---
    for (const seed of [11, 12, 13]) {
        const start = startRun(Generator, Tuning, seed);
        c.check('seed ' + seed + ': first section of 5 lanes at 850 m, 200 m long', ((start.firstFive !== null) && near(start.firstFive.from, 850) && near(start.firstFive.to, 1050)), JSON.stringify(start.firstFive));
        c.check('seed ' + seed + ': only 3 lanes before it', (start.fivesBefore === 0));
        c.check('seed ' + seed + ': the first encounter of blocks (. B6 .) about 450 m, alone', ((start.n1 !== null) && (start.n1 >= 450) && (start.n1 < 500) && start.n1Alone), 'z ' + start.n1);
        c.check('seed ' + seed + ': no block before it', (start.blockBefore === false));
        c.check('seed ' + seed + ': the first bonus a magnet on lane 0, after 530 m', ((start.bonus !== null) && (start.bonus.code === 'magnet') && (start.bonus.lane === 0) && (start.bonus.z >= 530)), JSON.stringify(start.bonus));
        c.check('seed ' + seed + ': no tier 1 pattern in the breath of tier 1 (300 to 450 m)', (start.breathBreak === 0), start.breathBreak + ' found');
    }

    // --- Seed ---
    const first = trackText(Generator, 7);
    c.check('same seed: same track', (trackText(Generator, 7) === first));
    c.check('another seed: another track', (trackText(Generator, 8) !== first));

    return c.failures;
}

// The rows of a locked tier: every element and section checked, the draws recorded.
function lockedRun(Generator, Entity, Tuning, Patterns, tier) {
    const stats = {rows: 0, empty: 0, offGrid: 0, badHoles: 0, offTrack: 0, inWarning: 0, badSections: 0, sections: 0, fives: 0, twoFives: 0,
        repeats: 0, badCoins: 0, outOfTier: 0, observed: new Map(), expected: new Map()};
    for (const seed of SEEDS) {
        const generator = new Generator().lockTier(tier).reset(seed, 0, null);
        const ids       = [];
        let offered     = null;
        // The probabilities offered at a row's first draw, and the pattern laid when that draw passed.
        const pick = generator._pickPlacement.bind(generator);
        generator._pickPlacement = function () {
            const placement = pick();
            if (offered === null) {
                offered = new Map();
                let total = 0;
                for (let i = 0; i < this._placementCount; i++) {
                    total += this._placements[i].weight;
                }
                for (let i = 0; i < this._placementCount; i++) {
                    const p = this._placements[i];
                    offered.set(p.pattern.id, ((offered.get(p.pattern.id) ?? 0) + (p.weight / total)));
                }
                offered.first = ((placement !== null) ? placement.pattern.id : null);
            }
            return placement;
        };
        const draw = generator._drawRow.bind(generator);
        generator._drawRow = function (...args) {
            offered = null;
            const pattern = draw(...args);
            stats.rows++;
            if (pattern === null) {
                stats.empty++;
                ids.push(null);
                return pattern;
            }
            ids.push(pattern.id);
            stats.outOfTier += ((pattern.tier > tier) ? 1 : 0);
            if ((offered !== null) && (offered.first === pattern.id)) {
                for (const [id, p] of offered) {
                    stats.expected.set(id, ((stats.expected.get(id) ?? 0) + p));
                }
                stats.observed.set(pattern.id, ((stats.observed.get(pattern.id) ?? 0) + 1));
            }
            return pattern;
        };
        const seen     = new Set();
        const sections = new Map();
        for (let z = 0; stats.rows < (ROWS * (SEEDS.indexOf(seed) + 1)); z += 3) {
            generator.update(z);
            for (const section of generator._sections) {
                sections.set(section.from, {from: section.from, to: section.to, lanes: section.lanes, first: section.first, warnFrom: section.warnFrom, clearFrom: section.clearFrom});
            }
            for (const entity of generator.getActive()) {
                if (seen.has(entity.getSerial())) {
                    continue;
                }
                seen.add(entity.getSerial());
                checkEntity(generator, entity, Entity, Tuning, stats);
            }
        }
        // Repetition: no Id among the window before it (the window of the catalogue: 3 at most).
        for (let i = 1; i < ids.length; i++) {
            if ((ids[i] !== null) && ids.slice(Math.max(0, (i - Tuning.PATTERN_RECENT_MAX)), i).includes(ids[i]) && windowOf(Patterns, Tuning, tier, ids, i)) {
                stats.repeats++;
            }
        }
        let previous = null;
        for (const section of [...sections.values()].sort((a, b) => (a.from - b.from))) {
            stats.sections++;
            const length = (section.to - section.from);
            const five   = (section.lanes === 5);
            const [min, max] = ((five) ? [Tuning.SECTION_5_MIN, Tuning.SECTION_5_MAX] : [Tuning.SECTION_3_MIN, Tuning.SECTION_3_MAX]);
            const first  = (previous === null);
            const ok     = (((section.from % Tuning.TILE_LENGTH) === 0) && ((length % Tuning.SECTION_STEP) === 0) && ((first) ? (length === Tuning.SECTION_FIRST) : ((length >= min) && (length <= max))));
            stats.badSections += ((ok) ? 0 : 1);
            stats.fives       += ((five) ? 1 : 0);
            stats.twoFives    += ((five && (previous !== null) && (previous.lanes === 5)) ? 1 : 0);
            previous = section;
        }
    }

    return stats;
}

// The window of non-repetition applies (a catalogue that offers few Ids has a shorter one).
function windowOf(Patterns, Tuning, tier, ids, i) {
    const candidates = Patterns.TABLE.filter((p) => ((p.weight > 0) && (p.tier <= tier) && !p.enemy)).length;
    const window     = Math.max(1, Math.min(Tuning.PATTERN_RECENT_MAX, (candidates - Tuning.PATTERN_RECENT_SPARE)));

    return ids.slice(Math.max(0, (i - window)), i).includes(ids[i]);
}

function checkEntity(generator, entity, Entity, Tuning, stats) {
    const z    = entity.getZ();
    const lane = entity.getLane();
    if (!entity.isObstacle()) {
        if (entity.getKind() === Entity.COIN) {
            for (const other of generator.getActive()) {
                if (other.isObstacle() && (other.getLane() === lane) && ((other.getKind() === Entity.BLOCK) || (other.getKind() === Entity.GAP)) && (z >= other.getZ()) && (z <= other.getEnd())) {
                    stats.badCoins++;
                    break;
                }
            }
        }
        stats.offTrack  += ((generator.laneExistsAt(lane, z)) ? 0 : 1);
        stats.inWarning += ((inWarning(generator, lane, z, z)) ? 1 : 0);
        return;
    }
    const cells = (z / Tuning.CELL);
    stats.offGrid += ((Math.abs(cells - Math.round(cells)) > 1e-6) ? 1 : 0);
    if (entity.getKind() === Entity.GAP) {
        const into = (((z % Tuning.TILE_LENGTH) + Tuning.TILE_LENGTH) % Tuning.TILE_LENGTH);
        stats.badHoles += ((Math.abs(into - Tuning.OBSTACLES[entity.getCode()].holeFrom) > 1e-6) ? 1 : 0);
    }
    const end = entity.getEnd();
    stats.offTrack  += ((generator.laneExistsAt(lane, z) && generator.laneExistsAt(lane, (end - 1e-6))) ? 0 : 1);
    stats.inWarning += ((inWarning(generator, lane, z, end)) ? 1 : 0);
}

// On an outer lane in a warning zone or a first section of 5, or on lanes −1 / +1 in a zone's last part.
function inWarning(generator, lane, from, to) {
    for (const section of generator._sections) {
        if ((section.lanes !== 5) || (to < section.from) || (from >= section.to)) {
            continue;
        }
        if ((Math.abs(lane) === 2) && (section.first || (to > section.warnFrom))) {
            return true;
        }
        if ((Math.abs(lane) === 1) && (to > section.clearFrom)) {
            return true;
        }
    }

    return false;
}

// A run from the start to 1 200 m: the sections, the first encounters, the first bonus.
function startRun(Generator, Tuning, seed) {
    const generator = new Generator().reset(seed, 0, null);
    const out       = {firstFive: null, fivesBefore: 0, n1: null, n1Alone: false, blockBefore: false, bonus: null, breathBreak: 0};
    const elements  = new Map();
    const rows      = [];
    const lay       = generator._layRow.bind(generator);
    generator._layRow = function (z) {
        lay(z);
        rows.push({z: this._row.z, id: ((this._row.pattern !== null) ? this._row.pattern.id : null)});
    };
    for (let z = 0; z < 1200; z += 2) {
        generator.update(z);
        for (const section of generator._sections) {
            if ((section.lanes === 5) && (out.firstFive === null)) {
                out.firstFive = {from: section.from, to: section.to, first: section.first};
            }
        }
        for (const entity of generator.getActive()) {
            if (!elements.has(entity.getSerial())) {
                elements.set(entity.getSerial(), {kind: entity.getKind(), code: entity.getCode(), lane: entity.getLane(), z: entity.getZ(), end: entity.getEnd()});
            }
        }
    }
    const n1 = rows.find((row) => (row.id === 'N1'));
    out.n1   = ((n1 !== undefined) ? n1.z : null);
    if (n1 !== undefined) {
        const others = [...elements.values()].filter((e) => ((e.kind !== 'coin') && (e.kind !== 'bonus') && (e.z !== n1.z) && (e.end > (n1.z - 15)) && (e.z < (n1.z + 21))));
        out.n1Alone     = (others.length === 0);
        out.blockBefore = [...elements.values()].some((e) => ((e.kind === 'block') && (e.z < n1.z)));
    }
    out.bonus       = [...elements.values()].find((e) => (e.kind === 'bonus')) ?? null;
    out.fivesBefore = 0;
    const tierOne   = new Set(['D1', 'D2', 'D3', 'D4', 'D5', 'K1', 'K2', 'K3']);
    out.breathBreak = rows.filter((row) => ((row.z >= 300) && (row.z < 450) && tierOne.has(row.id))).length;

    return out;
}

function trackText(Generator, seed) {
    const generator = new Generator().reset(seed, 0, null);
    const seen      = new Map();
    for (let z = 0; z < 3000; z += 5) {
        generator.update(z);
        for (const entity of generator.getActive()) {
            seen.set(entity.getSerial(), entity.getKind() + ':' + entity.getCode() + ':' + entity.getLane() + ':' + entity.getZ().toFixed(2) + ':' + entity.getY().toFixed(2));
        }
    }

    return [...seen.values()].join('|');
}

// Pearson's chi-square on the patterns, categories under 5 expected merged; p by the Wilson–Hilferty approximation.
function chiSquare(observed, expected) {
    let chi2   = 0;
    let df     = -1;
    let poolO  = 0;
    let poolE  = 0;
    for (const [id, e] of expected) {
        const o = (observed.get(id) ?? 0);
        if (e < 5) {
            poolO += o;
            poolE += e;
            continue;
        }
        chi2 += (((o - e) * (o - e)) / e);
        df++;
    }
    if (poolE >= 5) {
        chi2 += (((poolO - poolE) * (poolO - poolE)) / poolE);
        df++;
    }
    if (df < 1) {
        return {chi2: chi2, df: df, p: 1};
    }
    const zScore = ((Math.cbrt(chi2 / df) - (1 - (2 / (9 * df)))) / Math.sqrt(2 / (9 * df)));

    return {chi2: chi2, df: df, p: (1 - normalCdf(zScore))};
}

function normalCdf(x) {
    // Abramowitz and Stegun 7.1.26.
    const t = (1 / (1 + (0.3275911 * Math.abs(x) / Math.SQRT2)));
    const y = (1 - ((((((1.061405429 * t) - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2));

    return ((x >= 0) ? ((1 + y) / 2) : ((1 - y) / 2));
}

module.exports = {run};
