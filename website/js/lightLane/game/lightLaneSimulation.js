/**
 * The run, without the engine, the DOM or the loader (it runs in Node for the bench): fixed steps of 1/120 s fed by an
 * accumulator (gameplay § 1), the states of gameplay § 8.1 it owns (COUNTDOWN, RUNNING, DYING, GAME_OVER; the pause is
 * the game's), the tiers and the speed of the difficulty (§ 9.1), the runner (LightLaneRunner), the track
 * (LightLaneTrackGenerator), the collisions in the order of § 5.1 (gaps, obstacles, pick-ups; one collision a step),
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
     * @param {{tier?: int, seed?: int, track?: object[]|null, shield?: boolean, speed?: number|null}} options - speed: the
     *        test mode's fixed speed
     */
    newRun(options = {}) {
        const tier = (options.tier ?? 0);

        this._z             = LightLaneSimulation.tierStart(tier);
        this._runner.reset();
        this._savePrevious();
        this._runTime       = 0;
        this._distance      = 0;
        this._tier          = tier;
        this._speed         = LightLaneSimulation.tierSpeed(tier);
        this._rampFrom      = this._speed;
        this._rampTime      = LightLaneTuning.TIER_RAMP_SECONDS;
        this._accumulator   = 0;
        this._death         = null;
        this._shield        = (options.shield === true);
        this._fixedSpeed    = (options.speed ?? null);
        this._shieldDeaths  = 0;
        this._score.reset();
        this._events.clear();
        this._generator.reset((options.seed ?? LightLaneRandom.freshSeed()), this._z, (options.track ?? null));
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
        return this._runner.x;
    }

    getY() {
        return this._runner.y;
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
     * @returns {boolean} the lane exists at the runner's z (3 lanes until step 10 brings the sections)
     */
    laneExists(lane) {
        return LightLaneTuning.LANES_3.includes(lane);
    }

    static tierStart(tier) {
        const tiers = LightLaneTuning.TIERS;
        if (tier < tiers.length) {
            return tiers[tier].from;
        }

        return (tiers[tiers.length - 1].from + ((tier - (tiers.length - 1)) * LightLaneTuning.TIER_LATE_LENGTH));
    }

    static tierSpeed(tier) {
        const tiers = LightLaneTuning.TIERS;
        if (tier < tiers.length) {
            return tiers[tier].speed;
        }

        return Math.min(LightLaneTuning.SPEED_MAX, (tiers[tiers.length - 1].speed + ((tier - (tiers.length - 1)) * LightLaneTuning.TIER_LATE_SPEED_STEP)));
    }

    static tierAt(distance) {
        let tier = 0;
        while ((tier < LightLaneTuning.TIER_LAST) && (distance >= LightLaneSimulation.tierStart(tier + 1))) {
            tier++;
        }

        return tier;
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
        if (this._checkGaps() || this._checkObstacles()) {
            return;
        }
        this._checkCoins();
    }

    _checkGaps() {
        const runner = this._runner;
        for (const entity of this._generator.getActive()) {
            if ((entity.kind === LightLaneEntity.GAP) && LightLaneCollision.fallsInto(entity.box, runner.x, runner.y, this._z)) {
                this._kill(LightLaneRunner.DEATH_FALL);
                return true;
            }
        }

        return false;
    }

    _checkObstacles() {
        const runner = this._runner;
        const sweep  = LightLaneCollision.runnerBox(this._sweep, runner.x, runner.y, runner.getHeight(), this._previous.z, this._z);
        const before = LightLaneCollision.runnerBox(this._before, this._previous.x, this._previous.y, this._previous.height, this._previous.z, this._previous.z);
        for (const entity of this._generator.getActive()) {
            if (entity.hit || (entity.kind === LightLaneEntity.COIN) || (entity.kind === LightLaneEntity.GAP) || !LightLaneCollision.overlaps(sweep, entity.box)) {
                continue;
            }
            const entry   = LightLaneCollision.entry(before, entity.box);
            const outcome = LightLaneCollision.outcome(entity.kind, entry);
            // Already inside (the step before overlapped too): nothing new. A side entry is not marked: the element
            // stays solid, each new try from the side is a new stumble (the second while fragile kills).
            if (outcome === LightLaneCollision.IGNORE) {
                continue;
            }
            if (outcome === LightLaneCollision.DEATH) {
                entity.hit = true;
                this._kill(LightLaneRunner.DEATH_SHOCK);
                return true;
            }
            if (outcome === LightLaneCollision.STUMBLE_LAND) {
                // Landed on it, on its feet behind it: done with this element.
                entity.hit = true;
                runner.land();
            }
            if (runner.stumble(entry === LightLaneCollision.SIDE)) {
                this._kill(LightLaneRunner.DEATH_TRIP);
                return true;
            }
            this._events.add(LightLaneEvents.STUMBLE, null, entity);
            // One collision a step.
            return false;
        }

        return false;
    }

    _checkCoins() {
        const runner = this._runner;
        const reach  = LightLaneCollision.runnerBox(this._reach, runner.x, runner.y, runner.getHeight(), this._previous.z, this._z, LightLaneTuning.COIN_REACH);
        for (const entity of this._generator.getActive()) {
            if ((entity.kind === LightLaneEntity.COIN) && !entity.taken && LightLaneCollision.picks(reach, entity)) {
                entity.taken   = true;
                entity.takenAt = this._runTime;
                entity.takenDz = (entity.z - this._z);
                this._score.addCoin(LightLaneTuning.COIN_POINTS, false);
                this._events.add(LightLaneEvents.COIN, null, entity);
            }
        }
    }

    // The standing box at the runner's place cuts a gate (a slide goes on, a jump waits: gameplay § 3.5).
    _standingCutsGate() {
        const runner = this._runner;
        const box    = LightLaneCollision.runnerBox(this._standing, runner.x, runner.y, LightLaneTuning.RUNNER_HEIGHT, this._z, this._z);
        for (const entity of this._generator.getActive()) {
            if ((entity.kind === LightLaneEntity.GATE) && LightLaneCollision.overlaps(box, entity.box)) {
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
        this._previous.x      = runner.x;
        this._previous.y      = runner.y;
        this._previous.z      = this._z;
        this._previous.height = runner.getHeight();
    }

    _updateSpeed(dt) {
        // The test mode's fixed speed (gameplay § 13).
        if (this._fixedSpeed !== null) {
            this._speed = this._fixedSpeed;
            return;
        }
        const tier = LightLaneSimulation.tierAt(this._z);
        if (tier !== this._tier) {
            this._tier     = tier;
            this._rampFrom = this._speed;
            this._rampTime = 0;
        }
        const target   = LightLaneSimulation.tierSpeed(this._tier);
        this._rampTime = Math.min(LightLaneTuning.TIER_RAMP_SECONDS, (this._rampTime + dt));
        this._speed    = (this._rampFrom + ((target - this._rampFrom) * (this._rampTime / LightLaneTuning.TIER_RAMP_SECONDS)));
    }
}

LightLaneSimulation.COUNTDOWN = 'countdown';
LightLaneSimulation.RUNNING   = 'running';
LightLaneSimulation.DYING     = 'dying';
LightLaneSimulation.GAME_OVER = 'gameOver';
LightLaneSimulation.GO        = 'go';
