/**
 * The run, without the engine, the DOM or the loader (it runs in Node for the bench): fixed steps of 1/120 s fed by an
 * accumulator (gameplay § 1), the states of gameplay § 8.1 it owns (COUNTDOWN, RUNNING, DYING, GAME_OVER; the pause is
 * the game's), the tier and the speed of the difficulty (§ 9.1, LightLaneDifficulty), the runner (LightLaneRunner), the track
 * (LightLaneTrackGenerator), its enemies moved each step, the Sentinel (LightLaneSentinel), the collisions in the order of
 * § 5.1 (gaps and void, obstacles, enemies in relative positions, shots, pick-ups; one collision a step),
 * the score (LightLaneRunScore). The one-shot events go to getEvents(), read and emptied by the presentation. The
 * presentation reads the getters, never writes. No allocation per step once the pools are warm.
 *
 * The test mode's shield: a death is counted instead of played; a fall puts the runner back on lane 0, SHIELD_FALL_SKIP
 * ahead (at the same z it would fall again at once when the gap is on lane 0).
 */
class LightLaneSimulation {
    constructor() {
        this._state         = LightLaneSimulation.COUNTDOWN;
        this._newRun        = true;
        this._accumulator   = 0;
        this._countdown     = 0;
        this._runTime       = 0;
        this._z             = 0;
        this._previous      = {x: 0, y: 0, z: 0, height: LightLaneTuning.RUNNER_HEIGHT};
        this._distance      = 0;
        this._tier          = 0;
        this._speed         = 0;
        this._rampFrom      = 0;
        this._rampTime      = 0;
        this._score         = new LightLaneRunScore();
        this._events        = new LightLaneEvents();
        this._generator     = new LightLaneTrackGenerator();
        this._sentinel      = new LightLaneSentinel();
        this._runner        = new LightLaneRunner({
            laneExists:       (lane) => this.laneExists(lane),
            standingCutsGate: () => this._standingCutsGate()
        });
        this._death         = null;
        this._dyingTime     = 0;
        this._fallSpeed     = 0;
        this._fallForward   = 0;
        this._shield        = false;
        this._fixedSpeed    = null;
        this._shieldDeaths  = 0;
        this._pending       = [];     // orders received, handed to the next running step
        // Boxes reused every step.
        this._sweep         = {x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0};
        this._before        = {x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0};
        this._reach         = {x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0};
        this._standing      = {x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0};
    }

    /**
     * A new run: everything back to its start, the countdown of a new run.
     *
     * @param {{tier?: int, seed?: int, track?: object[]|null, shield?: boolean, speed?: number|null, locked?: boolean}} options -
     *        speed: the test mode's fixed speed; locked: the bench's locked tier (its speed fixed)
     */
    newRun(options = {}) {
        const tier = (options.tier ?? 0);

        this._z             = LightLaneDifficulty.tierStart(tier);
        this._runner.reset();
        this._savePrevious();
        this._runTime       = 0;
        this._distance      = 0;
        this._tier          = tier;
        this._speed         = LightLaneDifficulty.targetSpeed(this._z);
        this._rampFrom      = this._speed;
        this._rampTime      = LightLaneTuning.TIER_RAMP_SECONDS;
        this._accumulator   = 0;
        this._death         = null;
        this._shield        = (options.shield === true);
        this._fixedSpeed    = (options.speed ?? ((options.locked === true) ? LightLaneDifficulty.tierSpeed(tier) : null));
        this._shieldDeaths  = 0;
        this._score.reset();
        this._events.clear();
        const seed          = (options.seed ?? LightLaneRandom.freshSeed());
        // The bench's locked tier (generation § 8.3): its catalogue and its speed, fixed.
        this._generator.lockTier((options.locked === true) ? tier : null).setFixedSpeed(options.speed ?? null);
        this._generator.reset(seed, this._z, (options.track ?? null));
        this._sentinel.reset(seed);
        this._generator.update(this._z);
        this._startCountdown(true);

        return this;
    }

    // The countdown of a resume: the world stays as it was.
    resume() {
        this._startCountdown(false);

        return this;
    }

    /**
     * @param {number}   dt     - time elapsed, s (bounded by the engine)
     * @param {string[]} orders - the orders of this frame (LightLaneCommandSampler), dropped outside RUNNING; handed to
     *                            the next running step
     */
    advance(dt, orders) {
        // Kept until a running step takes them: a frame shorter than a step (above 120 Hz) runs none.
        if (this._state === LightLaneSimulation.RUNNING) {
            for (const order of orders) {
                this._pending.push(order);
            }
        } else {
            this._pending.length = 0;
        }
        this._accumulator += dt;
        while (this._accumulator >= LightLaneTuning.STEP_SECONDS) {
            this._accumulator -= LightLaneTuning.STEP_SECONDS;
            this._step(LightLaneTuning.STEP_SECONDS);
        }
        return this;
    }

    getState() {
        return this._state;
    }

    isNewRun() {
        return this._newRun;
    }

    /**
     * @returns {string|null} what the countdown shows now: '3', '2', '1', LightLaneSimulation.GO, or null
     */
    getCountdownLabel() {
        if (this._state !== LightLaneSimulation.COUNTDOWN) {
            return null;
        }
        const digits = LightLaneTuning.COUNTDOWN_DIGITS;
        const index  = Math.floor(this._countdown / LightLaneTuning.COUNTDOWN_DIGIT_TIME);

        return ((index < digits.length) ? String(digits[index]) : LightLaneSimulation.GO);
    }

    /**
     * @returns {number} 0 → 1 across the label shown (the HUD's zoom)
     */
    getCountdownPhase() {
        const digitsTime = (LightLaneTuning.COUNTDOWN_DIGITS.length * LightLaneTuning.COUNTDOWN_DIGIT_TIME);
        if (this._countdown < digitsTime) {
            return ((this._countdown % LightLaneTuning.COUNTDOWN_DIGIT_TIME) / LightLaneTuning.COUNTDOWN_DIGIT_TIME);
        }

        return Math.min(1, ((this._countdown - digitsTime) / LightLaneTuning.COUNTDOWN_GO_TIME));
    }

    getRunTime() {
        return this._runTime;
    }

    getX() {
        return this._runner.getX();
    }

    getY() {
        return this._runner.getY();
    }

    getZ() {
        return this._z;
    }

    /**
     * @returns {LightLaneRunner} read only
     */
    getRunner() {
        return this._runner;
    }

    getSpeed() {
        return this._speed;
    }

    getTier() {
        return this._tier;
    }

    // Metres run (a fall's drift after the death does not count).
    getDistance() {
        return this._distance;
    }

    /**
     * @returns {LightLaneRunScore}
     */
    getScore() {
        return this._score;
    }

    /**
     * @returns {LightLaneEvents} the events since the last clear(), the reader clears them
     */
    getEvents() {
        return this._events;
    }

    /**
     * @returns {LightLaneTrackGenerator} read only
     */
    getTrack() {
        return this._generator;
    }

    /**
     * @returns {LightLaneSentinel} read only
     */
    getSentinel() {
        return this._sentinel;
    }

    /**
     * The whole state of another simulation copied into this one, track, generator and random sources included (the
     * robot plays copies ahead): no allocation once the pools have grown to the other's size.
     *
     * @param {LightLaneSimulation} other
     * @returns {LightLaneSimulation} this
     */
    copyFrom(other) {
        this._state        = other._state;
        this._newRun       = other._newRun;
        this._accumulator  = other._accumulator;
        this._countdown    = other._countdown;
        this._runTime      = other._runTime;
        this._z            = other._z;
        this._previous.x      = other._previous.x;
        this._previous.y      = other._previous.y;
        this._previous.z      = other._previous.z;
        this._previous.height = other._previous.height;
        this._distance     = other._distance;
        this._tier         = other._tier;
        this._speed        = other._speed;
        this._rampFrom     = other._rampFrom;
        this._rampTime     = other._rampTime;
        this._death        = other._death;
        this._dyingTime    = other._dyingTime;
        this._fallSpeed    = other._fallSpeed;
        this._fallForward  = other._fallForward;
        this._shield       = other._shield;
        this._fixedSpeed   = other._fixedSpeed;
        this._shieldDeaths = other._shieldDeaths;
        this._pending.length = 0;
        for (const order of other._pending) {
            this._pending.push(order);
        }
        this._score.copyFrom(other._score);
        this._runner.copyFrom(other._runner);
        this._generator.copyFrom(other._generator);
        this._sentinel.copyFrom(other._sentinel);
        this._events.clear();

        return this;
    }

    /**
     * @returns {string|null} the death under way or done (LightLaneRunner.DEATH_*), null while alive
     */
    getDeath() {
        return this._death;
    }

    // Deaths counted instead of played, under the test mode's shield.
    getShieldDeaths() {
        return this._shieldDeaths;
    }

    /**
     * @param {int} lane
     * @returns {boolean} the lane exists at the runner's z (the section there, generation § 3)
     */
    laneExists(lane) {
        return this._generator.laneExistsAt(lane, this._z);
    }

    _startCountdown(newRun) {
        this._state     = LightLaneSimulation.COUNTDOWN;
        this._newRun    = newRun;
        this._countdown = 0;
    }

    _step(dt) {
        switch (this._state) {
            case LightLaneSimulation.COUNTDOWN:
                this._countdown += dt;
                if (this._countdown >= ((LightLaneTuning.COUNTDOWN_DIGITS.length * LightLaneTuning.COUNTDOWN_DIGIT_TIME) + LightLaneTuning.COUNTDOWN_GO_TIME)) {
                    this._state = LightLaneSimulation.RUNNING;
                    this._events.add(LightLaneEvents.START);
                }
                return;
            case LightLaneSimulation.RUNNING:
                this._run(dt);
                return;
            case LightLaneSimulation.DYING:
                this._die(dt);
                return;
            default:
        }
    }

    // A running step, in the order of gameplay § 5.1: move, gaps, obstacles, pick-ups.
    _run(dt) {
        const runner = this._runner;
        this._savePrevious();
        runner.step(dt, ((this._pending.length > 0) ? this._pending : null), this._events);
        this._pending.length = 0;
        this._runTime += dt;
        this._updateSpeed(dt);
        const metres = (this._speed * runner.getSpeedFactor() * dt);
        this._z        += metres;
        this._distance += metres;
        this._score.addDistance(metres, false);
        this._generator.update(this._z);
        this._moveEnemies(runner.getSpeedFactor());
        if (this._checkGaps() || this._checkObstacles() || this._checkEnemies() || this._checkTrails() || this._checkShots(dt)) {
            return;
        }
        this._checkCoins();
    }

    // The enemies follow the runner's advance (generation § 5); a stalker that starts announcing its move says so
    // (gameplay § 6.2: the announce's sound).
    _moveEnemies(factor) {
        const speed = (this._speed * factor);
        for (const entity of this._generator.getActive()) {
            if (!entity.isEnemy()) {
                continue;
            }
            const warned = entity.isWarning();
            entity.moveEnemy(this._z, speed);
            if (!warned && entity.isWarning()) {
                this._events.add(LightLaneEvents.ANNOUNCE, entity.getKind(), entity);
            }
        }
    }

    // An enemy's box against the runner's in relative positions (gameplay § 5.1): the runner swept over its move
    // relative to the enemy (the enemy's front moved back by its own move), classified against the enemy's box of the
    // step before.
    _checkEnemies() {
        const runner = this._runner;
        const before = LightLaneCollision.runnerBox(this._before, this._previous.x, this._previous.y, this._previous.height, this._previous.z, this._previous.z);
        for (const entity of this._generator.getActive()) {
            if (!entity.isEnemy() || entity.isHit()) {
                continue;
            }
            const moved = (entity.getBox().z0 - entity.getPrevBox().z0);
            const sweep = LightLaneCollision.runnerBox(this._sweep, runner.getX(), runner.getY(), runner.getHeight(), (this._previous.z + moved), this._z);
            if (!LightLaneCollision.overlaps(sweep, entity.getBox())) {
                continue;
            }
            const entry = LightLaneCollision.entry(before, entity.getPrevBox());
            if (this._collide(entity, entry)) {
                return true;
            }
            // One collision a step.
            return false;
        }

        return false;
    }

    // A bike's light trail (from TRAIL_TIER): a thin wall TRAIL_HEIGHT high along the path it left behind its back; the
    // runner's box touching it, or crossing it since the step before, under its top: a shock. A jump clears it.
    _checkTrails() {
        const runner = this._runner;
        if (runner.getY() >= LightLaneTuning.TRAIL_HEIGHT) {
            return false;
        }
        const reach = (LightLaneTuning.RUNNER_HALF_WIDTH + (LightLaneTuning.TRAIL_THICK / 2));
        const x     = runner.getX();
        const z     = this._z;
        for (const entity of this._generator.getActive()) {
            // Already dealt with (the test mode's shield counts one death a bike).
            if (!entity.hasTrail() || entity.isHit()) {
                continue;
            }
            const start = entity.getTrailStart();
            if ((z < start) || (z > (start + LightLaneTuning.TRAIL_LENGTH))) {
                continue;
            }
            // A crossing since the step before only counts when the runner was already beside the trail then (passing the
            // bike's back, the bike's path there says nothing of a trail).
            const side    = (x - entity.trailX(z));
            const beside  = (this._previous.z >= entity.getPrevTrailStart());
            const crossed = (beside && (((this._previous.x - entity.trailX(this._previous.z)) * side) < 0));
            if ((Math.abs(side) < reach) || crossed) {
                entity.markHit();
                this._kill(LightLaneRunner.DEATH_SHOCK);
                return true;
            }
        }

        return false;
    }

    // The Sentinel's pass starts where the generator planned it; its shots (gameplay § 7): a strike kills (a shock),
    // a sweep makes stumble (the lane change goes on).
    _checkShots(dt) {
        if (this._generator.takeSentinel(this._z)) {
            this._sentinel.start(this._runner.getX());
        }
        const outcome = this._sentinel.step(dt, this._runner, this._events);
        if (outcome === LightLaneSentinel.KILL) {
            this._kill(LightLaneRunner.DEATH_SHOCK);
            return true;
        }
        if (outcome === LightLaneSentinel.STUMBLE) {
            if (this._runner.stumble(false)) {
                this._kill(LightLaneRunner.DEATH_TRIP);
                return true;
            }
            this._events.add(LightLaneEvents.STUMBLE);
        }

        return false;
    }

    // A gap, or the void past the track's edge (an outer lane that ended, generation § 3).
    _checkGaps() {
        const runner = this._runner;
        const x      = runner.getX();
        const y      = runner.getY();
        for (const entity of this._generator.getActive()) {
            if ((entity.getKind() === LightLaneEntity.GAP) && LightLaneCollision.fallsInto(entity.getBox(), x, y, this._z)) {
                this._kill(LightLaneRunner.DEATH_FALL);
                return true;
            }
        }
        const outer = LightLaneTrackGenerator.OUTER;
        const last  = ((this._generator.laneExistsAt(outer, this._z)) ? outer : LightLaneTrackGenerator.MIDDLE);
        const edge  = ((last * LightLaneTuning.LANE_WIDTH) + (LightLaneTuning.LANE_WIDTH / 2));
        if ((y <= LightLaneTuning.VOID_FEET) && (Math.abs(x) > edge)) {
            this._kill(LightLaneRunner.DEATH_FALL);
            return true;
        }

        return false;
    }

    _checkObstacles() {
        const runner = this._runner;
        const sweep  = LightLaneCollision.runnerBox(this._sweep, runner.getX(), runner.getY(), runner.getHeight(), this._previous.z, this._z);
        const before = LightLaneCollision.runnerBox(this._before, this._previous.x, this._previous.y, this._previous.height, this._previous.z, this._previous.z);
        for (const entity of this._generator.getActive()) {
            if (entity.isHit() || !entity.isObstacle() || entity.isEnemy() || (entity.getKind() === LightLaneEntity.GAP) || !LightLaneCollision.overlaps(sweep, entity.getBox())) {
                continue;
            }
            const entry = LightLaneCollision.entry(before, entity.getBox());
            if (LightLaneCollision.outcome(entity.getKind(), entry) === LightLaneCollision.IGNORE) {
                continue;
            }
            if (this._collide(entity, entry)) {
                return true;
            }
            // One collision a step.
            return false;
        }

        return false;
    }

    /**
     * What an entry into an element does (gameplay § 5.2). Already inside (the step before overlapped too): nothing new.
     * A side entry is not marked: the element stays solid, each new try from the side is a new stumble (the second
     * while fragile kills).
     *
     * @returns {boolean} the runner died
     */
    _collide(entity, entry) {
        const runner  = this._runner;
        const outcome = LightLaneCollision.outcome(entity.getKind(), entry);
        if (outcome === LightLaneCollision.IGNORE) {
            return false;
        }
        if (outcome === LightLaneCollision.DEATH) {
            entity.markHit();
            this._kill(LightLaneRunner.DEATH_SHOCK);
            return true;
        }
        if (outcome === LightLaneCollision.STUMBLE_LAND) {
            // Landed on it, on its feet behind it: done with this element.
            entity.markHit();
            runner.land();
        }
        if (runner.stumble(entry === LightLaneCollision.SIDE)) {
            this._kill(LightLaneRunner.DEATH_TRIP);
            return true;
        }
        this._events.add(LightLaneEvents.STUMBLE, null, entity);

        return false;
    }

    _checkCoins() {
        const runner = this._runner;
        const reach  = LightLaneCollision.runnerBox(this._reach, runner.getX(), runner.getY(), runner.getHeight(), this._previous.z, this._z, LightLaneTuning.COIN_REACH);
        for (const entity of this._generator.getActive()) {
            if ((entity.getKind() === LightLaneEntity.COIN) && !entity.isTaken() && LightLaneCollision.picks(reach, entity)) {
                entity.take(this._runTime, (entity.getZ() - this._z));
                this._score.addCoin(LightLaneTuning.COIN_POINTS, false);
                this._events.add(LightLaneEvents.COIN, null, entity);
            }
        }
    }

    // The standing box at the runner's place cuts a gate (a slide goes on, a jump waits: gameplay § 3.5).
    _standingCutsGate() {
        const runner = this._runner;
        const box    = LightLaneCollision.runnerBox(this._standing, runner.getX(), runner.getY(), LightLaneTuning.RUNNER_HEIGHT, this._z, this._z);
        for (const entity of this._generator.getActive()) {
            if ((entity.getKind() === LightLaneEntity.GATE) && LightLaneCollision.overlaps(box, entity.getBox())) {
                return true;
            }
        }

        return false;
    }

    _kill(death) {
        if (this._shield) {
            this._shieldDeaths++;
            if (death === LightLaneRunner.DEATH_FALL) {
                const runner = this._runner;
                runner.reset();
                // Past the gap it fell into, on lane 0.
                this._z += LightLaneTuning.SHIELD_FALL_SKIP;
            }
            return;
        }
        this._state       = LightLaneSimulation.DYING;
        this._death       = death;
        this._dyingTime   = 0;
        this._fallSpeed   = 0;
        this._fallForward = (this._speed * this._runner.getSpeedFactor());
        this._events.add(LightLaneEvents.DEATH, death);
    }

    // Dying: the runner stopped, except in a fall: its speed ahead carries on, decaying fast (inertia), as it goes down
    // under the jump's gravity; then the game is over. The score no longer counts.
    _die(dt) {
        this._dyingTime += dt;
        if (this._death === LightLaneRunner.DEATH_FALL) {
            this._fallSpeed   += (LightLaneTuning.FALL_GRAVITY * dt);
            this._fallForward *= Math.exp(-LightLaneTuning.FALL_FORWARD_DECAY * dt);
            this._z           += (this._fallForward * dt);
            this._runner.drop(this._fallSpeed * dt);
        }
        if (this._dyingTime >= LightLaneTuning.DYING_TIME[this._death]) {
            this._state = LightLaneSimulation.GAME_OVER;
        }
    }

    _savePrevious() {
        const runner          = this._runner;
        this._previous.x      = runner.getX();
        this._previous.y      = runner.getY();
        this._previous.z      = this._z;
        this._previous.height = runner.getHeight();
    }

    _updateSpeed(dt) {
        // The test mode's fixed speed (gameplay § 13).
        if (this._fixedSpeed !== null) {
            this._speed = this._fixedSpeed;
            return;
        }
        const tier = LightLaneDifficulty.tierAt(this._z);
        if (tier !== this._tier) {
            this._tier     = tier;
            this._rampFrom = this._speed;
            this._rampTime = 0;
        }
        // The start's rise sets the speed itself; no tier ramp is under way when it ends.
        if (LightLaneDifficulty.isStarting(this._z)) {
            this._speed    = LightLaneDifficulty.startSpeed(this._z);
            this._rampTime = LightLaneTuning.TIER_RAMP_SECONDS;
            return;
        }
        const target   = LightLaneDifficulty.tierSpeed(this._tier);
        this._rampTime = Math.min(LightLaneTuning.TIER_RAMP_SECONDS, (this._rampTime + dt));
        this._speed    = (this._rampFrom + ((target - this._rampFrom) * (this._rampTime / LightLaneTuning.TIER_RAMP_SECONDS)));
    }
}

LightLaneSimulation.COUNTDOWN = 'countdown';
LightLaneSimulation.RUNNING   = 'running';
LightLaneSimulation.DYING     = 'dying';
LightLaneSimulation.GAME_OVER = 'gameOver';
LightLaneSimulation.GO        = 'go';
