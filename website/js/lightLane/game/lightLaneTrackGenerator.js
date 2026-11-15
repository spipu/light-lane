/**
 * The track as a stream (generation § 1): sections, rows and events are generated until zGenerated ≥ zRunner +
 * GENERATE_AHEAD; what passed behind zRunner − RETIRE_BEHIND goes back to the pool. Data only (LightLaneEntity), no
 * engine instance; no allocation per row once the pools are warm.
 *
 * - Sections (§ 3): 3 or 5 lanes, on whole tiles; the first of 5 lanes forced into tier 2; before the outer lanes end,
 *   the warning zone (nothing on them, tier 0 patterns in the middle, its end with the lanes −1 and +1 free).
 * - Rows (§ 4): the tier's gap plus a jitter, times the target speed (LightLaneDifficulty); a weighted draw among the
 *   placements (pattern, mirror, offset) the tier's catalogue allows, without the last ones, with the new tier's
 *   introduction factor; each draw passes the fairness check (LightLaneOccupancy, § 8) or is drawn again, ROW_TRIES
 *   times at most, then the row is left empty. A gap starts at its tile's start + holeFrom (§ 4.6).
 * - Enemies (§ 5): laid by their meeting point; their lanes reserved from ENEMY_RESERVE around it.
 * - The Sentinel's passes (§ 7.2), planned by distance before the sections: the track bridled while it is there (its
 *   patterns only, longer gaps), no section ending inside.
 * - First encounters (§ 6), bonuses (§ 7.1, flight excluded until plan step 12), scenery zones (§ 7.3).
 * - Coins (§ 9): the pattern's own, else a line with COIN_LINE_CHANCE on the clear lane most starts reach.
 *
 * The test mode's imposed rows come in order without the draw nor the check, then empty rows; lockTier (bench only)
 * fixes the tier, its speed and its catalogue and cuts the first encounters (§ 8.3).
 */
class LightLaneTrackGenerator {
    constructor() {
        this._random      = new LightLaneRandom(0);
        this._zoneRandom  = new LightLaneRandom(0);   // the scenery zones, drawn when the presentation asks
        this._occupancy   = new LightLaneOccupancy();
        this._active      = [];      // the entities on the track, in generation order
        this._pool        = [];
        this._serial      = 0;
        this._start       = 0;
        this._locked      = null;    // the bench's locked tier, or null
        this._fixedSpeed  = null;    // the test mode's fixed speed, or null
        this._imposed     = null;    // the test mode's rows still to come, or null
        this._sections    = [];      // {from, to, lanes, first, warnFrom, clearFrom}, in order
        this._spareSections = [];
        this._fiveForced  = null;    // z of the forced first section of 5 lanes still to come, or null
        this._nextRowZ    = 0;
        this._lastRowZ    = 0;       // front of the last row (the fairness window starts there)
        this._recent      = [];      // Ids of the last rows
        this._encounters  = [];      // the first encounters still to come: {z, pattern, bonus}, in order
        this._spareEncounters = [];
        this._nextBonusZ  = Infinity;
        this._lastBonus   = null;
        this._zones       = [];      // scenery zone of each ZONE_LENGTH from the start
        this._sentinels   = [];      // the Sentinel's passes: {z, end, started}, in order
        this._spareSentinels = [];
        this._nextSentinelZ  = Infinity;
        // The draw's placements, reused: {pattern, mirror, offset, z, weight}.
        this._placements  = Array.from({length: LightLaneTrackGenerator.PLACEMENTS_MAX}, () => ({pattern: null, mirror: false, offset: 0, z: 0, weight: 0}));
        this._placementCount = 0;
        this._row         = {pattern: null, lanes: null, offset: 0, z: 0};    // the row being laid
        this._probe       = new LightLaneEntity();   // a bike of the row being checked, for its trail's path
    }

    /**
     * @param {int}           seed
     * @param {number}        start   - z of the start
     * @param {object[]|null} imposed - the test mode's rows ({id, mirror, offset}), null to draw them
     * @returns {LightLaneTrackGenerator} this
     */
    reset(seed, start, imposed) {
        this._random     = new LightLaneRandom(seed);
        this._zoneRandom = new LightLaneRandom(seed ^ LightLaneTrackGenerator.ZONE_SEED);
        while (this._active.length > 0) {
            this._pool.push(this._active.pop().reset());
        }
        while (this._sections.length > 0) {
            this._spareSections.push(this._sections.pop());
        }
        while (this._sentinels.length > 0) {
            this._spareSentinels.push(this._sentinels.pop());
        }
        this._start         = start;
        this._nextRowZ      = (start + LightLaneTuning.FIRST_ROW);
        this._lastRowZ      = start;
        this._recent.length = 0;
        this._imposed       = ((imposed !== null) ? imposed.slice() : null);
        this._zones.length  = 0;
        this._lastBonus     = null;
        this._planEvents();

        return this;
    }

    /**
     * @param {LightLaneTrackGenerator} other
     * @returns {LightLaneTrackGenerator} this, in the state of other (the robot's copies of the simulation): its
     *          entities, sections, passes and random sources copied into this one's pools
     */
    copyFrom(other) {
        this._random.copyFrom(other._random);
        this._zoneRandom.copyFrom(other._zoneRandom);
        while (this._active.length > 0) {
            this._pool.push(this._active.pop().reset());
        }
        for (const entity of other._active) {
            const copy = ((this._pool.length > 0) ? this._pool.pop() : new LightLaneEntity());
            this._active.push(copy.copyFrom(entity));
        }
        this._serial        = other._serial;
        this._start         = other._start;
        this._locked        = other._locked;
        this._fixedSpeed    = other._fixedSpeed;
        this._fiveForced    = other._fiveForced;
        this._nextRowZ      = other._nextRowZ;
        this._lastRowZ      = other._lastRowZ;
        this._nextBonusZ    = other._nextBonusZ;
        this._lastBonus     = other._lastBonus;
        this._nextSentinelZ = other._nextSentinelZ;
        LightLaneTrackGenerator._copyList(this._recent, other._recent);
        LightLaneTrackGenerator._copyList(this._zones, other._zones);
        if (other._imposed === null) {
            this._imposed = null;
        } else {
            this._imposed = (this._imposed ?? []);
            LightLaneTrackGenerator._copyList(this._imposed, other._imposed);
        }
        LightLaneTrackGenerator._copyRecords(this._sections, this._spareSections, other._sections);
        LightLaneTrackGenerator._copyRecords(this._sentinels, this._spareSentinels, other._sentinels);
        LightLaneTrackGenerator._copyRecords(this._encounters, this._spareEncounters, other._encounters);

        return this;
    }

    static _copyList(out, list) {
        out.length = 0;
        for (const item of list) {
            out.push(item);
        }
    }

    // Plain records (sections, passes, encounters) copied field by field into pooled ones.
    static _copyRecords(out, spare, list) {
        while (out.length > 0) {
            spare.push(out.pop());
        }
        for (const record of list) {
            const copy = ((spare.length > 0) ? spare.pop() : {});
            for (const key in record) {
                copy[key] = record[key];
            }
            out.push(copy);
        }
    }

    /**
     * Bench only (generation § 8.3): the tier, its speed and its catalogue fixed; sections drawn by its rules; no first
     * encounter.
     *
     * @param {int|null} tier
     * @returns {LightLaneTrackGenerator} this, to be reset() after
     */
    lockTier(tier) {
        this._locked = tier;

        return this;
    }

    /**
     * Generates ahead of the runner, retires behind it.
     *
     * @param {number} z - the runner's z
     */
    update(z) {
        while (this._nextRowZ < (z + LightLaneTuning.GENERATE_AHEAD)) {
            this._layRow(this._nextRowZ);
        }
        const behind = (z - LightLaneTuning.RETIRE_BEHIND);
        let kept = 0;
        for (let i = 0; i < this._active.length; i++) {
            const entity = this._active[i];
            if (entity.getVisibleEnd() < behind) {
                this._pool.push(entity.reset());
                continue;
            }
            this._active[kept++] = entity;
        }
        this._active.length = kept;
        // Sections far behind (the tiles drawn behind the runner still read theirs).
        while ((this._sections.length > 1) && (this._sections[0].to < (behind - LightLaneTuning.TILE_LENGTH))) {
            this._spareSections.push(this._sections.shift());
        }
        while ((this._sentinels.length > 0) && this._sentinels[0].started && (this._sentinels[0].end < behind)) {
            this._spareSentinels.push(this._sentinels.shift());
        }
    }

    /**
     * The simulation's question each step: a pass of the Sentinel starts here.
     *
     * @param {number} z - the runner's z
     * @returns {boolean} true once for each pass, when the runner reaches its z
     */
    takeSentinel(z) {
        for (const sentinel of this._sentinels) {
            if (!sentinel.started && (sentinel.z <= z)) {
                sentinel.started = true;
                return true;
            }
        }

        return false;
    }

    /**
     * @param {number} z
     * @returns {boolean} the track is bridled for a pass of the Sentinel there (§ 7.2)
     */
    isBridled(z) {
        for (const sentinel of this._sentinels) {
            if ((z >= sentinel.z) && (z < sentinel.end)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @returns {LightLaneEntity[]} the entities on the track (read only)
     */
    getActive() {
        return this._active;
    }

    /**
     * @param {int}    lane
     * @param {number} z
     * @returns {boolean} the lane has a tile at z (the middle lanes always; the outer ones in a section of 5)
     */
    laneExistsAt(lane, z) {
        if (Math.abs(lane) <= LightLaneTrackGenerator.MIDDLE) {
            return true;
        }
        if (Math.abs(lane) > LightLaneTrackGenerator.OUTER) {
            return false;
        }
        const section = this.sectionAt(z);

        return ((section !== null) && (section.lanes === LightLaneTuning.LANES_5.length));
    }

    /**
     * @param {number} z
     * @returns {{from: number, to: number, lanes: int, first: boolean, warnFrom: number, clearFrom: number}|null} the
     *          section holding z (read only), null outside the planned ones
     */
    sectionAt(z) {
        for (const section of this._sections) {
            if ((z >= section.from) && (z < section.to)) {
                return section;
            }
        }

        return null;
    }

    /**
     * @param {int}    lane
     * @param {number} tileStart - z of a tile's start
     * @returns {boolean} an outer lane's tile in the warning zone before it ends (its edges blink red)
     */
    isWarnTile(lane, tileStart) {
        if (Math.abs(lane) !== LightLaneTrackGenerator.OUTER) {
            return false;
        }
        const section = this.sectionAt(tileStart);

        return ((section !== null) && (section.lanes === LightLaneTuning.LANES_5.length) && (tileStart >= section.warnFrom));
    }

    /**
     * @param {number} tileStart
     * @returns {boolean} the warning zone starts with this tile (the amber chevrons on the outer lanes)
     */
    isWarnStart(tileStart) {
        const section = this.sectionAt(tileStart);

        return ((section !== null) && (section.lanes === LightLaneTuning.LANES_5.length) && (Math.abs(tileStart - section.warnFrom) < LightLaneTrackGenerator.EPSILON));
    }

    /**
     * @param {number} tileStart
     * @returns {boolean} the outer lanes start with this tile (their front face shows)
     */
    isOuterStart(tileStart) {
        const section = this.sectionAt(tileStart);

        return ((section !== null) && (section.lanes === LightLaneTuning.LANES_5.length) && (Math.abs(tileStart - section.from) < LightLaneTrackGenerator.EPSILON));
    }

    /**
     * @param {int}    lane
     * @param {number} tileStart - z of a tile's start
     * @returns {string|null} the gap code (X3, X5) whose hole lies in that tile of that lane, or null
     */
    gapIn(lane, tileStart) {
        for (const entity of this._active) {
            const z = entity.getZ();
            if ((entity.getKind() === LightLaneEntity.GAP) && (entity.getLane() === lane) && (z >= tileStart) && (z < (tileStart + LightLaneTuning.TILE_LENGTH))) {
                return entity.getCode();
            }
        }

        return null;
    }

    /**
     * @param {number} z
     * @returns {string} the scenery zone there (LightLaneTuning.ZONES; drawn from plan step 13)
     */
    zoneAt(z) {
        const index = Math.max(0, Math.floor((z - this._start) / LightLaneTuning.ZONE_LENGTH));
        while (this._zones.length <= index) {
            const last  = ((this._zones.length > 0) ? this._zones[this._zones.length - 1] : null);
            const zones = LightLaneTuning.ZONES;
            let zone    = zones[this._zoneRandom.integer(0, (zones.length - 1))];
            if (zone === last) {
                zone = zones[(zones.indexOf(zone) + 1 + this._zoneRandom.integer(0, (zones.length - 2))) % zones.length];
            }
            this._zones.push(zone);
        }

        return this._zones[index];
    }

    // --- Difficulty seen by the generator ---

    _tierAt(z) {
        return ((this._locked !== null) ? this._locked : LightLaneDifficulty.tierAt(z));
    }

    _speedAt(z) {
        return ((this._locked !== null) ? LightLaneDifficulty.tierSpeed(this._locked) : LightLaneDifficulty.targetSpeed(z));
    }

    // A bike's speed as a share of the runner's there: ENEMY_SPEED over the runner's speed (the test mode's fixed one).
    _bikeShare(z) {
        return (LightLaneTuning.ENEMY_SPEED / ((this._fixedSpeed !== null) ? Math.max(this._fixedSpeed, LightLaneTuning.ENEMY_SPEED) : this._speedAt(z)));
    }

    /**
     * @param {number|null} speed - the run's fixed speed (the test mode's), the bikes' share follows it; null: none
     * @returns {LightLaneTrackGenerator} this, to be reset() after
     */
    setFixedSpeed(speed) {
        this._fixedSpeed = speed;

        return this;
    }

    // --- Events planned at the start: the forced section, the first encounters, the bonuses ---

    _planEvents() {
        const start            = this._start;
        const unlocked         = (this._locked === null);
        const fiveAt           = (LightLaneDifficulty.tierStart(LightLaneTuning.FIVE_TIER) + LightLaneTuning.FIVE_FIRST_AFTER);
        this._fiveForced       = ((unlocked && (start < fiveAt)) ? fiveAt : null);
        while (this._encounters.length > 0) {
            this._spareEncounters.push(this._encounters.pop());
        }
        const sentinelAt       = (LightLaneDifficulty.tierStart(LightLaneTuning.SENTINEL_TIER) + LightLaneTuning.SENTINEL_FIRST_AFTER);
        const startTier        = this._tierAt(start);
        if (unlocked && (start < sentinelAt)) {
            this._nextSentinelZ = sentinelAt;
        } else {
            this._nextSentinelZ = ((startTier >= LightLaneTuning.SENTINEL_TIER) ? (start + LightLaneTuning.SENTINEL_FIRST_AFTER) : Infinity);
        }
        if (!unlocked) {
            this._nextBonusZ = ((this._locked >= LightLaneTuning.BONUS_FIRST_TIER) ? (start + this._bonusStep(this._locked)) : Infinity);
            return;
        }
        const firstBonus = (LightLaneDifficulty.tierStart(LightLaneTuning.BONUS_FIRST_TIER) + LightLaneTuning.BONUS_FIRST_AFTER);
        for (const encounter of LightLaneTuning.ENCOUNTERS) {
            const z = (LightLaneDifficulty.tierStart(encounter.tier) + LightLaneTuning.ENCOUNTER_AFTER);
            if (z > start) {
                this._encounters.push(this._encounter(z, LightLanePatterns.get(encounter.pattern), null));
            }
        }
        if (firstBonus > start) {
            this._encounters.push(this._encounter(firstBonus, LightLanePatterns.get(LightLaneTrackGenerator.EMPTY), LightLaneTuning.BONUS_FIRST_TYPE));
            this._encounters.sort((a, b) => (a.z - b.z));
            this._nextBonusZ = Infinity;
            return;
        }
        this._encounters.sort((a, b) => (a.z - b.z));
        const tier       = LightLaneDifficulty.tierAt(start);
        this._nextBonusZ = ((tier >= LightLaneTuning.BONUS_FIRST_TIER) ? (start + this._bonusStep(tier)) : (firstBonus + this._bonusStep(LightLaneTuning.BONUS_FIRST_TIER)));
    }

    _encounter(z, pattern, bonus) {
        const encounter   = ((this._spareEncounters.length > 0) ? this._spareEncounters.pop() : {});
        encounter.z       = z;
        encounter.pattern = pattern;
        encounter.bonus   = bonus;

        return encounter;
    }

    _bonusStep(tier) {
        let range = LightLaneTuning.BONUS_EVERY[0];
        for (const every of LightLaneTuning.BONUS_EVERY) {
            if (tier >= every.from) {
                range = every;
            }
        }

        return this._random.between(range.min, range.max);
    }

    // --- The Sentinel's passes (§ 7.2) ---

    // Planned at least until z: each pass bridles the track over SENTINEL_BRIDLE × the target speed from its z.
    _planSentinels(z) {
        while (this._nextSentinelZ <= z) {
            const at       = this._nextSentinelZ;
            const sentinel = ((this._spareSentinels.length > 0) ? this._spareSentinels.pop() : {});
            sentinel.z       = at;
            sentinel.end     = (at + (LightLaneTuning.SENTINEL_BRIDLE * this._speedAt(at)));
            sentinel.started = false;
            this._sentinels.push(sentinel);
            this._nextSentinelZ = (at + this._random.between(LightLaneTuning.SENTINEL_EVERY[0], LightLaneTuning.SENTINEL_EVERY[1]));
        }
    }

    // A section's end that would fall in a bridled stretch is put off past it (§ 7.2).
    _pastBridles(to) {
        const tile = LightLaneTuning.SECTION_STEP;
        let end    = to;
        this._planSentinels(end + LightLaneTrackGenerator.SECTIONS_AHEAD);
        for (const sentinel of this._sentinels) {
            if ((end >= sentinel.z) && (end <= sentinel.end)) {
                end = (Math.ceil(sentinel.end / tile) * tile);
                this._planSentinels(end + LightLaneTrackGenerator.SECTIONS_AHEAD);
            }
        }

        return end;
    }

    // --- Sections (§ 3) ---

    // Planned at least until z.
    _planSections(z) {
        while ((this._sections.length === 0) || (this._sections[this._sections.length - 1].to <= z)) {
            this._planSection();
        }
    }

    _planSection() {
        const count   = this._sections.length;
        const last    = ((count > 0) ? this._sections[count - 1] : null);
        const from    = ((last !== null) ? last.to : this._start);
        const section = ((this._spareSections.length > 0) ? this._spareSections.pop() : {});
        const step    = LightLaneTuning.SECTION_STEP;
        section.from  = from;
        section.first = false;
        if ((this._fiveForced !== null) && (Math.abs(from - this._fiveForced) < LightLaneTrackGenerator.EPSILON)) {
            section.lanes      = LightLaneTuning.LANES_5.length;
            section.to         = (from + LightLaneTuning.FIVE_FIRST_LENGTH);
            section.first      = true;
            this._fiveForced   = null;
        } else {
            const tier = this._tierAt(from);
            const five = ((last !== null) && (last.lanes === LightLaneTuning.LANES_3.length) && (tier >= LightLaneTuning.FIVE_TIER)
                && (this._fiveForced === null) && this._random.chance(this._fiveChance(tier)));
            let length;
            if (last === null) {
                length = LightLaneTuning.SECTION_FIRST;
            } else if (five) {
                length = (step * this._random.integer((LightLaneTuning.SECTION_5_MIN / step), (LightLaneTuning.SECTION_5_MAX / step)));
            } else {
                length = (step * this._random.integer((LightLaneTuning.SECTION_3_MIN / step), (LightLaneTuning.SECTION_3_MAX / step)));
            }
            section.lanes = ((five) ? LightLaneTuning.LANES_5.length : LightLaneTuning.LANES_3.length);
            section.to    = (from + length);
            // The section of 3 lanes before the forced one of 5 ends right at it, shortened or lengthened.
            if ((this._fiveForced !== null) && ((section.to > this._fiveForced) || ((this._fiveForced - section.to) < LightLaneTuning.SECTION_3_MIN))) {
                section.to = this._fiveForced;
            }
        }
        section.to = this._pastBridles(section.to);
        const speed       = this._speedAt(section.to);
        const tile        = LightLaneTuning.TILE_LENGTH;
        section.warnFrom  = Math.max(section.from, (Math.floor((section.to - (LightLaneTuning.WARN_TIME * speed)) / tile) * tile));
        section.clearFrom = (section.to - (LightLaneTuning.CLEAR_TIME * speed));
        this._sections.push(section);
    }

    _fiveChance(tier) {
        return Math.min(LightLaneTuning.FIVE_CHANCE_MAX, (LightLaneTuning.FIVE_CHANCE + ((tier - LightLaneTuning.FIVE_TIER) * LightLaneTuning.FIVE_CHANCE_STEP)));
    }

    // --- Rows (§ 4) ---

    _layRow(rowZ) {
        const tier  = this._tierAt(rowZ);
        const speed = this._speedAt(rowZ);
        const base  = LightLaneTuning.ROW_GAPS[Math.min(tier, (LightLaneTuning.ROW_GAPS.length - 1))];
        const calm  = ((this._imposed === null) && this.isBridled(rowZ));
        let gap     = LightLaneTrackGenerator._snap((base + this._random.between(0, LightLaneTuning.ROW_GAP_JITTER)) * speed * ((calm) ? LightLaneTuning.SENTINEL_GAP : 1));
        let z       = rowZ;
        let pattern = null;
        let bonus   = null;
        const row   = this._row;
        this._planSections(rowZ + LightLaneTrackGenerator.SECTIONS_AHEAD);
        const encounter = ((this._encounters.length > 0) ? this._encounters[0] : null);
        let met         = false;
        if ((this._imposed === null) && (encounter !== null) && ((rowZ + (gap / 2)) >= encounter.z)) {
            // A first encounter: alone, ENCOUNTER_GAP times the gap before and after it.
            this._encounters.shift();
            z   = Math.max(rowZ, LightLaneTrackGenerator._snap(this._lastRowZ + (LightLaneTuning.ENCOUNTER_GAP * gap)));
            gap = LightLaneTrackGenerator._snap(LightLaneTuning.ENCOUNTER_GAP * gap);
            if (this._setRow(encounter.pattern, false, 0, z) && this._fits(row, true) && this._isFair(row, speed, tier)) {
                pattern = encounter.pattern;
                bonus   = encounter.bonus;
                met     = true;
                this._spareEncounters.push(encounter);
            } else {
                // Refused (a placement or the check): the row stays empty, the encounter moves to the next row.
                encounter.z = (z + 1);
                this._encounters.unshift(encounter);
                z = row.z;
            }
            if (bonus !== null) {
                this._nextBonusZ = (z + this._bonusStep(tier));
            }
        } else if (this._imposed !== null) {
            pattern = this._imposedRow(z);
        } else {
            pattern = this._drawRow(z, tier, speed);
        }
        if (pattern !== null) {
            z = row.z;
            const longest = pattern.longest;
            if (longest > (gap - (LightLaneTuning.LONG_ELEMENT_MARGIN * speed))) {
                gap = LightLaneTrackGenerator._snap(longest + (LightLaneTuning.LONG_ELEMENT_MARGIN * speed));
            }
        }
        this._lastRowZ = z;
        this._nextRowZ = (z + gap);
        if (pattern === null) {
            // An empty row: a line of coins on lane 0 (the test mode's rows after its written ones: nothing).
            if ((this._imposed === null) && !this._reserved(0, z, this._nextRowZ)) {
                this._line(0, z, this._nextRowZ);
            }
            return;
        }
        this._placeElements(row);
        if ((bonus === null) && (z >= this._nextBonusZ)) {
            bonus            = this._drawBonusType();
            this._nextBonusZ = (z + this._bonusStep(tier));
        }
        const bonusLane = ((bonus !== null) ? this._placeBonus(row, bonus, z, this._nextRowZ) : null);
        this._coins(row, z, speed, this._nextRowZ, bonusLane, met);
    }

    // The test mode's next row (then empty ones), laid without the check: the pattern, or null.
    _imposedRow(z) {
        const imposed = this._imposed.shift();
        if (imposed === undefined) {
            this._row.z = z;
            return null;
        }
        const pattern = LightLanePatterns.get(imposed.id);
        if (pattern === undefined) {
            throw new Error('LightLaneTrackGenerator - unknown pattern ' + imposed.id);
        }
        this._setRow(pattern, imposed.mirror, imposed.offset, z);

        return pattern;
    }

    // The weighted draw of § 4.5 with the fairness check; null after ROW_TRIES refusals (an empty row).
    _drawRow(z, tier, speed) {
        this._collectPlacements(z, tier);
        for (let tries = 0; tries < LightLaneTuning.ROW_TRIES; tries++) {
            const placement = this._pickPlacement();
            if (placement === null) {
                break;
            }
            this._setRow(placement.pattern, placement.mirror, placement.offset, placement.z);
            if (this._isFair(this._row, speed, tier)) {
                this._remember(placement.pattern.id);
                return placement.pattern;
            }
            placement.weight = 0;
        }
        this._row.z = z;

        return null;
    }

    // Every placement (pattern, mirror, offset) the tier and the place allow, with its weight (§ 4.5, steps 1 to 3).
    _collectPlacements(z, realTier) {
        const section   = this.sectionAt(z);
        const five      = ((section !== null) && (section.lanes === LightLaneTuning.LANES_5.length));
        const calm      = ((section !== null) && (section.first || (five && (z >= section.warnFrom))));
        const catalogue = ((calm) ? 0 : this._catalogueTier(z, realTier));
        const bridled   = this.isBridled(z);
        const offsets   = ((five && !calm) ? LightLaneTrackGenerator.OFFSETS_5 : LightLaneTrackGenerator.OFFSETS_3);
        const window    = this._recentWindow(catalogue, five);
        let count       = 0;
        for (const pattern of LightLanePatterns.TABLE) {
            if ((pattern.weight <= 0) || (pattern.tier > catalogue) || this._isRecent(pattern.id, window)) {
                continue;
            }
            if (bridled && !LightLaneTuning.SENTINEL_PATTERNS.includes(pattern.id)) {
                continue;
            }
            const wide = (pattern.lanes.length === LightLaneTuning.LANES_5.length);
            if (wide && (!five || calm)) {
                continue;
            }
            const first = count;
            for (let o = 0; o < ((wide) ? 1 : offsets.length); o++) {
                for (const mirror of LightLaneTrackGenerator.MIRRORS) {
                    const placement = this._placements[count];
                    placement.pattern = pattern;
                    placement.mirror  = mirror;
                    placement.offset  = ((wide) ? 0 : offsets[o]);
                    this._setRow(pattern, placement.mirror, placement.offset, z);
                    // Aligned for a gap, a row may move into a bridled stretch: its patterns only there.
                    if (!this._fits(this._row, false) || (!bridled && this.isBridled(this._row.z) && !LightLaneTuning.SENTINEL_PATTERNS.includes(pattern.id))) {
                        continue;
                    }
                    placement.z = this._row.z;
                    count++;
                }
            }
            const factor = this._introFactor(pattern, z);
            for (let i = first; i < count; i++) {
                this._placements[i].weight = ((pattern.weight * factor) / (count - first));
            }
        }
        this._placementCount = count;
    }

    // The tier whose catalogue a row draws from: the tier before during a tier's first BREATH_LENGTH metres.
    _catalogueTier(z, tier) {
        if ((this._locked !== null) || (tier === 0) || (z >= (LightLaneDifficulty.tierStart(tier) + LightLaneTuning.BREATH_LENGTH))) {
            return tier;
        }

        return (tier - 1);
    }

    // The patterns of a tier come in from INTRO_FACTOR to 1 over INTRO_LENGTH metres after its breath (§ 4.5, step 3).
    _introFactor(pattern, z) {
        if ((this._locked !== null) || (pattern.tier === 0)) {
            return 1;
        }
        const from = (LightLaneDifficulty.tierStart(pattern.tier) + LightLaneTuning.BREATH_LENGTH);
        const s    = Math.min(1, Math.max(0, ((z - from) / LightLaneTuning.INTRO_LENGTH)));

        return (LightLaneTuning.INTRO_FACTOR + ((1 - LightLaneTuning.INTRO_FACTOR) * s));
    }

    // w = max(1, min(PATTERN_RECENT_MAX, candidates − PATTERN_RECENT_SPARE)) of the catalogue.
    _recentWindow(catalogue, five) {
        let candidates = 0;
        for (const pattern of LightLanePatterns.TABLE) {
            if ((pattern.weight > 0) && (pattern.tier <= catalogue) && (five || (pattern.lanes.length === LightLaneTuning.LANES_3.length))) {
                candidates++;
            }
        }

        return Math.max(1, Math.min(LightLaneTuning.PATTERN_RECENT_MAX, (candidates - LightLaneTuning.PATTERN_RECENT_SPARE)));
    }

    _isRecent(id, window) {
        const recent = this._recent;
        for (let i = Math.max(0, (recent.length - window)); i < recent.length; i++) {
            if (recent[i] === id) {
                return true;
            }
        }

        return false;
    }

    _remember(id) {
        this._recent.push(id);
        if (this._recent.length > LightLaneTuning.PATTERN_RECENT_MAX) {
            this._recent.shift();
        }
    }

    _pickPlacement() {
        let total = 0;
        for (let i = 0; i < this._placementCount; i++) {
            total += this._placements[i].weight;
        }
        if (total <= 0) {
            return null;
        }
        let draw = (this._random.next() * total);
        let last = null;
        for (let i = 0; i < this._placementCount; i++) {
            const placement = this._placements[i];
            if (placement.weight <= 0) {
                continue;
            }
            last  = placement;
            draw -= placement.weight;
            if (draw < 0) {
                return placement;
            }
        }

        return last;
    }

    // The row being laid: its lanes (mirrored or not), its offset, its z aligned for a gap (§ 4.6). False when the
    // pattern is wider than the lanes there.
    _setRow(pattern, mirror, offset, z) {
        const row   = this._row;
        row.pattern = pattern;
        row.lanes   = ((mirror) ? pattern.mirrored : pattern.lanes);
        row.offset  = offset;
        row.z       = LightLaneTrackGenerator._gapAligned(z, row.lanes, pattern.corridor);

        return true;
    }

    // Every element of the row on a lane that exists over its length, clear of the warning zones (§ 3, § 4.5 step 2);
    // `encounter`: a first encounter's row, laid whatever the zone.
    _fits(row, encounter) {
        const lanes = row.lanes;
        for (let i = 0; i < lanes.length; i++) {
            const code = lanes[i];
            if (code === '.') {
                continue;
            }
            const lane  = this._laneOf(row, i);
            const front = this._frontOf(row, i);
            const end   = (front + LightLaneTuning.OBSTACLES[code].length);
            if (!this._laneSpans(lane, front, end)) {
                return false;
            }
            if (!encounter && !this._clearOfWarnings(lane, front, end)) {
                return false;
            }
            if (!this._clearOfReservations(row, i, lane, front, end)) {
                return false;
            }
        }

        return true;
    }

    /**
     * An element clear of the enemies' reservations (§ 5): none of an enemy already laid covers its lanes (an enemy's:
     * its lane and its destination, over its own reservation) over its length; an enemy's own lanes exist all along its
     * reservation and hold nothing else (laid before, or of its row).
     */
    _clearOfReservations(row, i, lane, front, end) {
        const [before, after] = LightLaneTuning.ENEMY_RESERVE;
        const code  = row.lanes[i];
        const enemy = LightLanePatterns.isEnemy(code);
        const to    = (lane + ((enemy) ? (LightLaneTuning.OBSTACLES[code].side ?? 0) : 0));
        const from  = ((enemy) ? (front + before) : front);
        const till  = ((enemy) ? (front + after) : end);
        for (const entity of this._active) {
            if (!entity.isEnemy() || ((entity.getZ() + before) >= till) || ((entity.getZ() + after) <= from)) {
                continue;
            }
            const a = entity.getLane();
            const b = entity.getToLane();
            if ((a === lane) || (b === lane) || (a === to) || (b === to)) {
                return false;
            }
        }
        if (!enemy) {
            return true;
        }
        if (!this._laneSpans(lane, from, till) || !this._laneSpans(to, from, till)) {
            return false;
        }
        for (const entity of this._active) {
            const onLanes = ((entity.getLane() === lane) || (entity.getLane() === to));
            if (entity.isObstacle() && onLanes && (entity.getZ() < till) && (entity.getEnd() > from)) {
                return false;
            }
        }
        for (let k = 0; k < row.lanes.length; k++) {
            const other = this._laneOf(row, k);
            if ((k !== i) && (row.lanes[k] !== '.') && ((other === lane) || (other === to))) {
                return false;
            }
        }

        return this._clearOfCorridor(to, front);
    }

    /**
     * An enemy is never met just out of a corridor (§ 5, user decision): it is refused when every existing neighbour of
     * its meeting lane holds an element laid before that started before its blocked cells (ENEMY_BLOCKS) and ended less
     * than CORRIDOR_EXIT × the speed before them; the runner gets that time to see the way out and change lane.
     */
    _clearOfCorridor(lane, front) {
        const from  = (front + LightLaneTuning.ENEMY_BLOCKS[0]);
        const since = (from - (LightLaneTuning.CORRIDOR_EXIT * this._speedAt(front)));
        let closed  = 0;
        for (const side of LightLaneTrackGenerator.SIDES) {
            const next = (lane + side);
            if (!this.laneExistsAt(next, from)) {
                continue;
            }
            let shut = false;
            for (const entity of this._active) {
                if (entity.isObstacle() && !entity.isEnemy() && (entity.getLane() === next) && (entity.getZ() < from) && (entity.getEnd() > since)) {
                    shut = true;
                    break;
                }
            }
            if (!shut) {
                return true;
            }
            closed++;
        }

        return (closed === 0);
    }

    // An enemy laid earlier reserves the lane over [from, to] (no coin nor bonus there).
    _reserved(lane, from, to) {
        const [before, after] = LightLaneTuning.ENEMY_RESERVE;
        for (const entity of this._active) {
            if (entity.isEnemy() && ((entity.getLane() === lane) || (entity.getToLane() === lane)) && ((entity.getZ() + before) < to) && ((entity.getZ() + after) > from)) {
                return true;
            }
        }

        return false;
    }

    // The lane exists all along [from, to].
    _laneSpans(lane, from, to) {
        if (Math.abs(lane) <= LightLaneTrackGenerator.MIDDLE) {
            return true;
        }
        const section = this.sectionAt(from);

        return ((section !== null) && (section.lanes === LightLaneTuning.LANES_5.length) && (to <= section.to));
    }

    // Nothing on an outer lane in the warning zone, nothing on the lanes −1 and +1 in its last CLEAR_TIME, nothing on the
    // outer lanes of the first section of 5.
    _clearOfWarnings(lane, from, to) {
        for (const section of this._sections) {
            if ((section.lanes !== LightLaneTuning.LANES_5.length) || (to <= section.from) || (from >= section.to)) {
                continue;
            }
            const outer = (Math.abs(lane) === LightLaneTrackGenerator.OUTER);
            if (outer && (section.first || (to > section.warnFrom))) {
                return false;
            }
            if ((Math.abs(lane) === LightLaneTrackGenerator.MIDDLE) && (to > section.clearFrom)) {
                return false;
            }
        }

        return true;
    }

    _laneOf(row, i) {
        const lanes = row.lanes;
        if (lanes.length === LightLaneTuning.LANES_5.length) {
            return LightLaneTuning.LANES_5[i];
        }

        return (LightLaneTuning.LANES_3[i] + row.offset);
    }

    // The centre element of a corridor is centred along its blocks (§ 4.2).
    _frontOf(row, i) {
        if (!row.pattern.corridor || (i !== 1)) {
            return row.z;
        }
        const block = LightLaneTuning.OBSTACLES[row.lanes[0]].length;

        return (row.z + LightLaneTrackGenerator._snap((block - LightLaneTuning.OBSTACLES[row.lanes[1]].length) / 2));
    }

    // --- Fairness (§ 8) ---

    // The row passes the check of § 8.2 (every start lane gets through, or else every one an empty row would let through).
    _isFair(row, speed, tier) {
        if (this._searchWindow(row, true, speed, tier)) {
            return true;
        }
        // Lanes doomed before the row (a trail ahead) are not its fault (§ 8.2): it passes when every start lane an
        // empty row would let through still gets through, and at least one does. The grid is then laid again with the
        // row, for the coins' reach counts.
        const reaching = this._occupancy.getReaching();
        this._searchWindow(row, false, speed, tier);
        const baseline = this._occupancy.getReaching();
        if ((baseline === 0) || ((reaching & baseline) !== baseline)) {
            return false;
        }
        this._searchWindow(row, true, speed, tier);

        return true;
    }

    // The window from the last row's front to the end of this one: the void, the elements already laid, this row's (when
    // withRow); true when every passable start lane reaches past it.
    _searchWindow(row, withRow, speed, tier) {
        const occupancy = this._occupancy;
        const z0        = this._lastRowZ;
        const end       = (row.z + row.pattern.longest);
        occupancy.begin(z0, (end + LightLaneTuning.CELL));
        this._markVoid(z0, (end + LightLaneTuning.CELL));
        for (const entity of this._active) {
            if (entity.isObstacle() && ((entity.getEnd() > z0) || (entity.hasTrail() && ((entity.getZ() + LightLaneTrackGenerator.TRAIL_REACH) > z0)))) {
                LightLaneTrackGenerator._markEntity(occupancy, entity.getCode(), entity.getLane(), entity.getZ());
                if (entity.hasTrail()) {
                    LightLaneTrackGenerator._markTrail(occupancy, entity, speed);
                }
            }
        }
        for (let i = 0; (withRow && (i < row.lanes.length)); i++) {
            const code = row.lanes[i];
            if (code === '.') {
                continue;
            }
            const front = this._frontOf(row, i);
            LightLaneTrackGenerator._markEntity(occupancy, code, this._laneOf(row, i), front);
            if (LightLanePatterns.isEnemy(code) && (this._tierAt(front) >= LightLaneTuning.TRAIL_TIER)) {
                LightLaneTrackGenerator._markTrail(occupancy, this._probe.setObstacle(code, this._laneOf(row, i), front).setShare(this._bikeShare(front)), speed);
            }
        }
        const boots = ((this._locked ?? tier) >= LightLaneTuning.FAIR_BOOTS_TIER);
        occupancy.applyVertical(speed, ((boots) ? LightLaneTuning.JUMP_TIME_BOOTS : LightLaneTuning.JUMP_TIME));

        return occupancy.isFair(1, occupancy.cellOf(end - LightLaneTuning.CELL), speed);
    }

    // The outer lanes' cells without a tile.
    _markVoid(z0, z1) {
        const cell = LightLaneTuning.CELL;
        for (let z = z0; z < z1; z += cell) {
            if (this.laneExistsAt(LightLaneTrackGenerator.OUTER, z)) {
                continue;
            }
            this._occupancy.mark(-LightLaneTrackGenerator.OUTER, z, (z + cell), LightLaneOccupancy.VOID);
            this._occupancy.mark(LightLaneTrackGenerator.OUTER, z, (z + cell), LightLaneOccupancy.VOID);
        }
    }

    // An enemy blocks the lane where it meets the runner (a stalker: its destination; its lane of start is free) over
    // ENEMY_BLOCKS around its meeting point (§ 8.1).
    static _markEntity(occupancy, code, lane, front) {
        const spec = LightLaneTuning.OBSTACLES[code];
        if (LightLanePatterns.isEnemy(code)) {
            const [from, to] = LightLaneTuning.ENEMY_BLOCKS;
            occupancy.mark((lane + (spec.side ?? 0)), (front + from), (front + to), LightLaneOccupancy.BLOCKED);
            return;
        }
        occupancy.mark(lane, front, (front + spec.length), LightLaneTrackGenerator.CELL_STATE[spec.kind]);
    }

    /**
     * A bike's trail in the fairness grid (§ 8.1), where the runner would meet it: its point under the runner at z was
     * left when the bike's back was there, and the runner is there when the bike's front is at zm + share × (zm − z),
     * so from zm + length / (1 + share) to zm + (length + TRAIL_LENGTH) / (1 + share); each lane the trail (and the
     * runner beside it) may touch there is blocked. Its jump over it is not counted (the check stays on the safe side).
     */
    static _markTrail(occupancy, entity, speed) {
        const share  = (1 + entity.getShare());
        const from   = (entity.getZ() + (entity.getLength() / share));
        const to     = (entity.getZ() + ((entity.getLength() + LightLaneTuning.TRAIL_LENGTH) / share));
        const reach  = ((LightLaneTuning.LANE_WIDTH / 2) + LightLaneTuning.RUNNER_HALF_WIDTH + (LightLaneTuning.TRAIL_THICK / 2));
        const cell   = LightLaneTuning.CELL;
        for (let z = from; z < to; z += cell) {
            const x = entity.trailX(z, speed);
            for (const lane of LightLaneTuning.LANES_5) {
                if (Math.abs((lane * LightLaneTuning.LANE_WIDTH) - x) < reach) {
                    occupancy.mark(lane, z, (z + cell), LightLaneOccupancy.BLOCKED);
                }
            }
        }
    }

    // --- Elements, bonuses, coins ---

    _placeElements(row) {
        const lanes = row.lanes;
        for (let i = 0; i < lanes.length; i++) {
            if (lanes[i] === '.') {
                continue;
            }
            const front  = this._frontOf(row, i);
            const entity = this._take().setObstacle(lanes[i], this._laneOf(row, i), front);
            entity.setTrail(LightLanePatterns.isEnemy(lanes[i]) && (this._tierAt(front) >= LightLaneTuning.TRAIL_TIER));
            entity.setShare(this._bikeShare(front));
        }
    }

    // Weighted, never the same twice in a row (§ 7.1).
    _drawBonusType() {
        const types   = LightLaneTrackGenerator.BONUS_TYPES;
        const weights = LightLaneTrackGenerator.BONUS_WEIGHTS;
        let total     = 0;
        for (let i = 0; i < types.length; i++) {
            total += ((types[i] === this._lastBonus) ? 0 : weights[i]);
        }
        let draw = (this._random.next() * total);
        let pick = null;
        for (let i = 0; i < types.length; i++) {
            if (types[i] === this._lastBonus) {
                continue;
            }
            pick  = types[i];
            draw -= weights[i];
            if (draw < 0) {
                break;
            }
        }

        return pick;
    }

    // Halfway to the next row, on a lane of the row without an element (lane 0 first, then the nearest the centre);
    // none fits: no bonus. Returns its lane, or null.
    _placeBonus(row, type, z, nextZ) {
        const at = LightLaneTrackGenerator._snap((z + row.pattern.longest + nextZ) / 2);
        for (const lane of LightLaneTrackGenerator.CENTRE_FIRST_5) {
            if (this._rowHolds(row, lane) || !this._laneSpans(lane, at, at) || !this._clearOfWarnings(lane, at, at) || this._reserved(lane, at, at)) {
                continue;
            }
            this._take().setBonus(type, lane, at);
            this._lastBonus = type;
            return lane;
        }

        return null;
    }

    _rowHolds(row, lane) {
        for (let i = 0; i < row.lanes.length; i++) {
            if ((row.lanes[i] !== '.') && (this._laneOf(row, i) === lane)) {
                return true;
            }
        }

        return false;
    }

    // `shown`: a first encounter's row, its coins always on the way the most starts reach.
    _coins(row, z, speed, nextZ, bonusLane, shown) {
        const pattern = row.pattern;
        const lanes   = row.lanes;
        if (pattern.coins === 'arc') {
            // Its coins span a jump on both sides of the hurdle: none where a warning zone keeps the lane clear, nor where
            // the lane does not exist all along (a hurdle at the start of a section of 5).
            const lane = this._laneOf(row, lanes.indexOf('H'));
            const span = (speed * LightLaneTuning.JUMP_TIME);
            if (this._clearOfWarnings(lane, (z - span), (z + span)) && this._laneSpans(lane, (z - span), (z + span)) && !this._reserved(lane, (z - span), (z + span))) {
                this._arc(lane, z, speed);
            }
            return;
        }
        if (pattern.coins === 'line') {
            const lane = this._laneOf(row, 1);
            if (!this._reserved(lane, z, nextZ)) {
                this._line(lane, (z + pattern.longest), nextZ);
            }
            return;
        }
        if (pattern.coins === 'centre') {
            const length = LightLaneTuning.OBSTACLES[lanes[0]].length;
            // None in an enemy's reservation (§ 5).
            if (this._reserved(this._laneOf(row, 1), z, (z + length))) {
                return;
            }
            for (let at = (z + (LightLaneTuning.COIN_SPACING / 2)); at < (z + length); at += LightLaneTuning.COIN_SPACING) {
                this._take().setCoin(this._laneOf(row, 1), LightLaneTuning.COIN_HEIGHT, at);
            }
            return;
        }
        if (!shown && !this._random.chance(LightLaneTuning.COIN_LINE_CHANCE)) {
            return;
        }
        // The clear lane most starts of the search reach; a tie: the nearest the centre (§ 9). Alongside the row.
        const from = z;
        const to   = (nextZ - LightLaneTuning.COIN_SPACING);
        let best   = null;
        let reach  = -1;
        for (const lane of LightLaneTrackGenerator.CENTRE_FIRST_5) {
            if ((lane === bonusLane) || this._rowHolds(row, lane) || !this._laneSpans(lane, from, to) || !this._clearOfWarnings(lane, from, to) || this._blockedAlong(lane, from, to) || this._reserved(lane, from, to)) {
                continue;
            }
            const count = this._occupancy.getReach(lane);
            if (count > reach) {
                best  = lane;
                reach = count;
            }
        }
        if (best !== null) {
            this._line(best, (from - LightLaneTuning.COIN_SPACING), nextZ);
            return;
        }
        // No clear lane: low coins under a gate of the row, the nearest the centre.
        for (const lane of LightLaneTrackGenerator.CENTRE_FIRST_5) {
            for (let i = 0; i < lanes.length; i++) {
                if ((lanes[i] === 'P') && (this._laneOf(row, i) === lane)) {
                    const centre = (z + (LightLaneTuning.OBSTACLES.P.length / 2));
                    const reach  = (((LightLaneTuning.COIN_GATE_COUNT - 1) / 2) * LightLaneTuning.COIN_SPACING);
                    if (this._clearOfWarnings(lane, (centre - reach), (centre + reach)) && !this._reserved(lane, (centre - reach), (centre + reach))) {
                        this._gateCoins(lane, z);
                    }
                    return;
                }
            }
        }
    }

    // An obstacle laid earlier lies on the lane over [from, to] (a long block of a row before).
    _blockedAlong(lane, from, to) {
        for (const entity of this._active) {
            if (entity.isObstacle() && (entity.getLane() === lane) && (entity.getZ() < to) && (entity.getEnd() > from)) {
                return true;
            }
        }

        return false;
    }

    // 5 to 10 coins, COIN_SPACING apart, from `from` and ending before the next row.
    _line(lane, from, nextZ) {
        const count = this._random.integer(LightLaneTuning.COIN_LINE_MIN, LightLaneTuning.COIN_LINE_MAX);
        for (let k = 0; k < count; k++) {
            const at = (from + (LightLaneTuning.COIN_SPACING * (k + 1)));
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
        const from    = LightLaneTrackGenerator.hurdleClearFrom();
        const early   = (((1 - from) * T) - (depth / speed));
        const late    = (from * T);
        const contact = ((z + spec.z0) - LightLaneTuning.RUNNER_HALF_DEPTH);
        const start   = (contact - (speed * ((early + late) / 2)));
        for (let k = 0; k < LightLaneTuning.COIN_ARC_COUNT; k++) {
            const t = ((T * (k + 1)) / (LightLaneTuning.COIN_ARC_COUNT + 1));
            const y = (4 * H * (t / T) * (1 - (t / T)));
            this._take().setCoin(lane, (y + LightLaneTuning.COIN_HEIGHT), (start + (speed * t)));
        }
    }

    _take() {
        const entity = ((this._pool.length > 0) ? this._pool.pop() : new LightLaneEntity());
        entity.setSerial(++this._serial);
        this._active.push(entity);

        return entity;
    }

    // A row holding a gap is moved on until its gap starts at a tile's start + holeFrom (generation § 4.6); the gap
    // centred in a corridor (G4) stands its centring offset ahead of the row.
    static _gapAligned(z, lanes, corridor) {
        let index = -1;
        for (let i = 0; i < lanes.length; i++) {
            if ((lanes[i] !== '.') && !LightLanePatterns.isEnemy(lanes[i]) && (LightLaneTuning.OBSTACLES[lanes[i]].kind === LightLaneEntity.GAP)) {
                index = i;
                break;
            }
        }
        if (index < 0) {
            return z;
        }
        const spec   = LightLaneTuning.OBSTACLES[lanes[index]];
        const offset = ((corridor && (index === 1)) ? LightLaneTrackGenerator._snap((LightLaneTuning.OBSTACLES[lanes[0]].length - spec.length) / 2) : 0);
        const tile   = LightLaneTuning.TILE_LENGTH;

        return (((Math.ceil((((z + offset) - spec.holeFrom) / tile) - LightLaneTrackGenerator.EPSILON) * tile) + spec.holeFrom) - offset);
    }

    /**
     * The share of a normal jump (t / T) from which the feet are above the hurdle's top, until 1 − that share:
     * 4H·u(1 − u) ≥ y1, so u from (1 − √(1 − y1 / H)) / 2 (gameplay § 4; 0.173 with the start values).
     *
     * @returns {number}
     */
    static hurdleClearFrom() {
        return ((1 - Math.sqrt(1 - (LightLaneTuning.OBSTACLES.H.y1 / LightLaneTuning.JUMP_HEIGHT))) / 2);
    }

    static _snap(value) {
        return (Math.round(value / LightLaneTuning.CELL) * LightLaneTuning.CELL);
    }
}

// The middle lanes (|lane| ≤ 1) always exist; the outer ones (|lane| = 2) in a section of 5.
LightLaneTrackGenerator.MIDDLE         = 1;
LightLaneTrackGenerator.OUTER          = 2;
// Lanes the nearest the centre first.
LightLaneTrackGenerator.CENTRE_FIRST_5 = Object.freeze([0, -1, 1, -2, 2]);
// Offsets of a 3-lane pattern in a section of 3 or of 5 lanes (§ 4.2).
LightLaneTrackGenerator.OFFSETS_3      = Object.freeze([0]);
LightLaneTrackGenerator.OFFSETS_5      = Object.freeze([-1, 0, 1]);
// A placement as drawn and mirrored.
LightLaneTrackGenerator.MIRRORS        = Object.freeze([false, true]);
// A lane's two neighbours, by their offset.
LightLaneTrackGenerator.SIDES          = Object.freeze([-1, 1]);
// Room for every placement: patterns × offsets × mirrors.
LightLaneTrackGenerator.PLACEMENTS_MAX = 400;
// Sections planned this far past a row (its longest element and its coins).
LightLaneTrackGenerator.SECTIONS_AHEAD = 100;
// The bonus types and their draw weights, in a fixed order.
LightLaneTrackGenerator.BONUS_TYPES    = Object.freeze(Object.keys(LightLaneTuning.BONUS_TYPES));
LightLaneTrackGenerator.BONUS_WEIGHTS  = Object.freeze(Object.values(LightLaneTuning.BONUS_TYPES));
// The first encounter of the first bonus: a row without any element.
LightLaneTrackGenerator.EMPTY          = 'N0';
LightLaneTrackGenerator.EPSILON        = 1e-6;
// How far past its meeting point a bike's trail can block the runner (§ 8.1, _markTrail): the farthest, at the top speed.
LightLaneTrackGenerator.TRAIL_REACH    = ((LightLaneTuning.OBSTACLES.R.length + LightLaneTuning.TRAIL_LENGTH) / (1 + (LightLaneTuning.ENEMY_SPEED / LightLaneTuning.SPEED_MAX)));
// The scenery zones' own random source: seeded from the run's, so the track never depends on when they are read.
LightLaneTrackGenerator.ZONE_SEED      = 0x5A17;
// The occupancy of each kind of element (§ 8.1).
LightLaneTrackGenerator.CELL_STATE     = Object.freeze({
    hurdle: LightLaneOccupancy.JUMP,
    gate:   LightLaneOccupancy.SLIDE,
    block:  LightLaneOccupancy.BLOCKED,
    gap:    LightLaneOccupancy.GAP,
});
