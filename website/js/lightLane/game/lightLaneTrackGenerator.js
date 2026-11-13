/**
 * The track as a stream (generation § 1): rows are generated until zGenerated ≥ zRunner + GENERATE_AHEAD, what passed
 * behind zRunner − RETIRE_BEHIND goes back to the pool. Data only (LightLaneEntity), no engine instance.
 *
 * Rows (generation § 4.1): the first at FIRST_ROW from the start, then the tier's gap plus a jitter, times its target
 * speed, on the 0.5 m grid; a long element pushes the next row back; a gap starts at its tile's start + holeFrom
 * (§ 4.6); the centre element of a corridor is centred along its blocks. The pattern of a row: the test mode's next
 * one when it imposes the track (then empty rows), otherwise a weighted draw among the patterns of the tier, not
 * repeating the last ones (§ 4.5, steps 1 to 4). Coins (§ 9): the pattern's own (arc over the hurdle, rest line,
 * corridor centre), else a line with COIN_LINE_CHANCE on the free lane nearest the centre.
 *
 * Plan step 8: 3 lanes, no enemy, no fairness check; step 9 brings the sections, the 5 lanes and the check.
 */
class LightLaneTrackGenerator {
    constructor() {
        this._random     = new LightLaneRandom(0);
        this._active     = [];      // the entities on the track, in generation order
        this._pool       = [];
        this._nextRowZ   = 0;
        this._recent     = [];      // Ids of the last rows
        this._imposed    = null;    // the test mode's rows still to come, or null
        this._candidates = [];
        this._serial     = 0;
    }

    /**
     * @param {int}         seed
     * @param {number}      start   - z of the start
     * @param {object[]|null} imposed - the test mode's rows ({id, mirror, offset}), null to draw them
     */
    reset(seed, start, imposed) {
        this._random = new LightLaneRandom(seed);
        while (this._active.length > 0) {
            this._pool.push(this._active.pop().reset());
        }
        this._nextRowZ      = (start + LightLaneTuning.FIRST_ROW);
        this._recent.length = 0;
        this._imposed       = ((imposed !== null) ? imposed.slice() : null);

        return this;
    }

    /**
     * Generates ahead of the runner, retires behind it.
     *
     * @param {number} z - the runner's z
     */
    update(z) {
        while (this._nextRowZ < (z + LightLaneTuning.GENERATE_AHEAD)) {
            this._row(this._nextRowZ);
        }
        const behind = (z - LightLaneTuning.RETIRE_BEHIND);
        let kept = 0;
        for (let i = 0; i < this._active.length; i++) {
            const entity = this._active[i];
            if (Math.max(entity.getEnd(), entity.z) < behind) {
                this._pool.push(entity.reset());
                continue;
            }
            this._active[kept++] = entity;
        }
        this._active.length = kept;
    }

    /**
     * @returns {LightLaneEntity[]} the entities on the track (read only)
     */
    getActive() {
        return this._active;
    }

    /**
     * @param {int}    lane
     * @param {number} tileStart - z of a tile's start
     * @returns {string|null} the gap code (X3, X5) whose hole lies in that tile of that lane, or null
     */
    gapIn(lane, tileStart) {
        for (const entity of this._active) {
            if ((entity.kind === LightLaneEntity.GAP) && (entity.lane === lane) && (entity.z >= tileStart) && (entity.z < (tileStart + LightLaneTuning.TILE_LENGTH))) {
                return entity.code;
            }
        }

        return null;
    }

    _row(rowZ) {
        const tier    = LightLaneSimulation.tierAt(rowZ);
        const speed   = LightLaneSimulation.tierSpeed(tier);
        const pattern = this._pickPattern(tier);
        let z         = rowZ;
        let lanes     = null;
        let longest   = 0;
        if (pattern !== null) {
            lanes = ((pattern.mirror) ? LightLanePatterns.mirror(pattern.pattern.lanes) : pattern.pattern.lanes);
            z     = LightLaneTrackGenerator._gapAligned(z, lanes, pattern.pattern.corridor);
            longest = Math.max(...lanes.map((code) => ((code === '.') ? 0 : LightLaneTuning.OBSTACLES[code].length)));
        }
        let gap = (LightLaneTrackGenerator._snap((LightLaneTuning.ROW_GAPS[Math.min(tier, LightLaneTuning.ROW_GAPS.length - 1)]
            + this._random.between(0, LightLaneTuning.ROW_GAP_JITTER)) * speed));
        if (longest > (gap - (LightLaneTuning.LONG_ELEMENT_MARGIN * speed))) {
            gap = LightLaneTrackGenerator._snap(longest + (LightLaneTuning.LONG_ELEMENT_MARGIN * speed));
        }
        this._nextRowZ = (z + gap);
        if (pattern === null) {
            return;
        }
        const blockLength = ((pattern.pattern.corridor) ? LightLaneTuning.OBSTACLES[lanes[0]].length : 0);
        lanes.forEach((code, i) => {
            if (code === '.') {
                return;
            }
            const lane   = (LightLaneTuning.LANES_3[i] + pattern.offset);
            const centre = ((pattern.pattern.corridor) && (i === 1));
            const front  = ((centre) ? (z + LightLaneTrackGenerator._snap((blockLength - LightLaneTuning.OBSTACLES[code].length) / 2)) : z);
            this._take().setObstacle(code, lane, front);
        });
        this._coins(pattern, lanes, z, speed, (z + gap));
    }

    // The test mode's next row (then none), or a weighted draw: {pattern, mirror, offset} or null for an empty row.
    _pickPattern(tier) {
        if (this._imposed !== null) {
            const row = this._imposed.shift();
            if (row === undefined) {
                return null;
            }
            const pattern = LightLanePatterns.get(row.id);
            if (pattern === undefined) {
                throw new Error('LightLaneTrackGenerator - unknown pattern ' + row.id);
            }
            return {pattern: pattern, mirror: row.mirror, offset: row.offset};
        }
        const candidates = this._candidates;
        candidates.length = 0;
        for (const pattern of LightLanePatterns.TABLE) {
            if ((pattern.tier <= tier) && (pattern.lanes.length === 3) && !pattern.lanes.some((code) => LightLanePatterns.ENEMIES.includes(code))) {
                candidates.push(pattern);
            }
        }
        const window  = Math.max(1, Math.min(LightLaneTrackGenerator.RECENT_MAX, (candidates.length - LightLaneTrackGenerator.RECENT_SPARE)));
        const recent  = this._recent.slice(-window);
        const allowed = candidates.filter((pattern) => !recent.includes(pattern.id));
        const total   = allowed.reduce((sum, pattern) => (sum + pattern.weight), 0);
        let draw      = (this._random.next() * total);
        let chosen    = allowed[allowed.length - 1];
        for (const pattern of allowed) {
            draw -= pattern.weight;
            if (draw < 0) {
                chosen = pattern;
                break;
            }
        }
        this._recent.push(chosen.id);
        if (this._recent.length > LightLaneTrackGenerator.RECENT_MAX) {
            this._recent.shift();
        }

        return {pattern: chosen, mirror: this._random.chance(LightLaneTrackGenerator.MIRROR_CHANCE), offset: 0};
    }

    _coins(placed, lanes, z, speed, nextZ) {
        const pattern = placed.pattern;
        const laneOf  = (i) => (LightLaneTuning.LANES_3[i] + placed.offset);
        if (pattern.coins === 'arc') {
            const i = lanes.indexOf('H');
            this._arc(laneOf(i), z, speed);
            return;
        }
        if (pattern.coins === 'line') {
            this._line(laneOf(1), z, nextZ);
            return;
        }
        if (pattern.coins === 'centre') {
            const length = LightLaneTuning.OBSTACLES[lanes[0]].length;
            for (let at = (z + LightLaneTuning.COIN_SPACING / 2); at < (z + length); at += LightLaneTuning.COIN_SPACING) {
                this._take().setCoin(laneOf(1), LightLaneTuning.COIN_HEIGHT, at);
            }
            return;
        }
        if (!this._random.chance(LightLaneTuning.COIN_LINE_CHANCE)) {
            return;
        }
        // The free lane nearest the centre, the centre first.
        const free = [1, 0, 2].find((i) => (lanes[i] === '.'));
        if (free === undefined) {
            const gate = [1, 0, 2].find((i) => (lanes[i] === 'P'));
            if (gate !== undefined) {
                this._gateCoins(laneOf(gate), z);
            }
            return;
        }
        const longest = Math.max(0, ...lanes.map((code) => ((code === '.') ? 0 : LightLaneTuning.OBSTACLES[code].length)));
        this._line(laneOf(free), (z + longest), nextZ);
    }

    // 5 to 10 coins, COIN_SPACING apart, from `from` and ending before the next row.
    _line(lane, from, nextZ) {
        const count = this._random.integer(LightLaneTuning.COIN_LINE_MIN, LightLaneTuning.COIN_LINE_MAX);
        for (let k = 0; k < count; k++) {
            const at = (from + LightLaneTuning.COIN_SPACING * (k + 1));
            if (at > (nextZ - LightLaneTuning.COIN_SPACING)) {
                break;
            }
            this._take().setCoin(lane, LightLaneTuning.COIN_HEIGHT, at);
        }
    }

    // COIN_GATE_COUNT coins low under a gate, centred on its beam (picked up sliding).
    _gateCoins(lane, z) {
        const centre = (z + (LightLaneTuning.OBSTACLES.P.length / 2));
        const half   = ((LightLaneTuning.COIN_GATE_COUNT - 1) / 2);
        for (let k = 0; k < LightLaneTuning.COIN_GATE_COUNT; k++) {
            this._take().setCoin(lane, LightLaneTuning.COIN_LOW_HEIGHT, (centre + ((k - half) * LightLaneTuning.COIN_SPACING)));
        }
    }

    // COIN_ARC_COUNT coins on the path of a normal jump started in the middle of its window (gameplay § 4).
    _arc(lane, z, speed) {
        const spec    = LightLaneTuning.OBSTACLES.H;
        const T       = LightLaneTuning.JUMP_TIME;
        const H       = LightLaneTuning.JUMP_HEIGHT;
        const depth   = ((2 * LightLaneTuning.RUNNER_HALF_DEPTH) + (spec.z1 - spec.z0));
        const early   = (LightLaneTrackGenerator.HURDLE_CLEAR_UNTIL * T - (depth / speed));
        const late    = (LightLaneTrackGenerator.HURDLE_CLEAR_FROM * T);
        const contact = ((z + spec.z0) - LightLaneTuning.RUNNER_HALF_DEPTH);
        const start   = (contact - (speed * ((early + late) / 2)));
        for (let k = 0; k < LightLaneTuning.COIN_ARC_COUNT; k++) {
            const t = (T * (k + 1) / (LightLaneTuning.COIN_ARC_COUNT + 1));
            const y = (4 * H * (t / T) * (1 - (t / T)));
            this._take().setCoin(lane, (y + LightLaneTuning.COIN_HEIGHT), (start + (speed * t)));
        }
    }

    _take() {
        const entity  = ((this._pool.length > 0) ? this._pool.pop() : new LightLaneEntity());
        entity.serial = ++this._serial;
        this._active.push(entity);

        return entity;
    }

    // A row holding a gap is moved on until its gap starts at a tile's start + holeFrom (generation § 4.6); the gap
    // centred in a corridor (G4) stands its centring offset ahead of the row.
    static _gapAligned(z, lanes, corridor) {
        const index = lanes.findIndex((code) => ((code !== '.') && (LightLaneTuning.OBSTACLES[code].kind === LightLaneEntity.GAP)));
        if (index < 0) {
            return z;
        }
        const spec   = LightLaneTuning.OBSTACLES[lanes[index]];
        const offset = ((corridor && (index === 1)) ? LightLaneTrackGenerator._snap((LightLaneTuning.OBSTACLES[lanes[0]].length - spec.length) / 2) : 0);
        const tile   = LightLaneTuning.TILE_LENGTH;

        return (((Math.ceil(((z + offset) - spec.holeFrom) / tile) * tile) + spec.holeFrom) - offset);
    }

    static _snap(value) {
        return (Math.round(value / LightLaneTuning.CELL) * LightLaneTuning.CELL);
    }
}

LightLaneTrackGenerator.RECENT_MAX    = 3;
LightLaneTrackGenerator.RECENT_SPARE  = 2;
LightLaneTrackGenerator.MIRROR_CHANCE = 0.5;
// A normal jump clears a hurdle's 0.80 m for t / T in [0.173, 0.827] (gameplay § 4).
LightLaneTrackGenerator.HURDLE_CLEAR_FROM  = 0.173;
LightLaneTrackGenerator.HURDLE_CLEAR_UNTIL = 0.827;
