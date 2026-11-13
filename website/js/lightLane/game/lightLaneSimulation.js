/**
 * The run, without the engine, the DOM or the loader (it runs in Node for the bench): fixed steps of 1/120 s fed by an
 * accumulator (gameplay § 1), the states of gameplay § 8.1 it owns (COUNTDOWN, RUNNING; the pause is the game's), the
 * tiers and the speed of the difficulty (gameplay § 9.1), the runner's advance. The presentation reads its getters,
 * never writes it. No allocation per step.
 *
 * Plan step 7: the runner only runs ahead on lane 0; its moves, the obstacles and the deaths come with step 8.
 */
class LightLaneSimulation {
    constructor() {
        this._state         = LightLaneSimulation.COUNTDOWN;
        this._newRun        = true;
        this._accumulator   = 0;
        this._countdown     = 0;     // time spent in the countdown
        this._runTime       = 0;     // time spent running
        this._z             = 0;     // runner's feet, z
        this._x             = 0;
        this._y             = 0;
        this._lane          = 0;
        this._startDistance = 0;
        this._tier          = 0;
        this._speed         = 0;
        this._rampFrom      = 0;
        this._rampTime      = 0;
        this._score         = new LightLaneRunScore();
    }

    /**
     * A new run: everything back to its start, the countdown of a new run.
     *
     * @param {int} tier - the tier to start at (0, or the test mode's)
     */
    newRun(tier = 0) {
        const start         = LightLaneSimulation.tierStart(tier);
        this._startDistance = start;
        this._z             = start;
        this._x             = 0;
        this._y             = 0;
        this._lane          = 0;
        this._runTime       = 0;
        this._tier          = tier;
        this._speed         = LightLaneSimulation.tierSpeed(tier);
        this._rampFrom      = this._speed;
        this._rampTime      = LightLaneTuning.TIER_RAMP_SECONDS;
        this._accumulator   = 0;
        this._score.reset();
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
     * @param {string[]} orders - the orders of this frame (LightLaneCommandSampler), dropped outside RUNNING
     */
    advance(dt, orders) {
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

    // The countdown under way is a new run's (the runner idles) rather than a resume's (all frozen).
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
        return this._x;
    }

    getY() {
        return this._y;
    }

    getZ() {
        return this._z;
    }

    getLane() {
        return this._lane;
    }

    getSpeed() {
        return this._speed;
    }

    /**
     * @returns {LightLaneRunScore}
     */
    getScore() {
        return this._score;
    }

    getTier() {
        return this._tier;
    }

    // Metres run since the start of the run.
    getDistance() {
        return (this._z - this._startDistance);
    }

    /**
     * @param {int} tier
     * @returns {number} where the tier starts, m (gameplay § 9.1)
     */
    static tierStart(tier) {
        const tiers = LightLaneTuning.TIERS;
        if (tier < tiers.length) {
            return tiers[tier].from;
        }

        return (tiers[tiers.length - 1].from + ((tier - (tiers.length - 1)) * LightLaneTuning.TIER_LATE_LENGTH));
    }

    /**
     * @param {int} tier
     * @returns {number} the tier's target speed, m/s
     */
    static tierSpeed(tier) {
        const tiers = LightLaneTuning.TIERS;
        if (tier < tiers.length) {
            return tiers[tier].speed;
        }

        return Math.min(LightLaneTuning.SPEED_MAX, (tiers[tiers.length - 1].speed + ((tier - (tiers.length - 1)) * LightLaneTuning.TIER_LATE_SPEED_STEP)));
    }

    /**
     * @param {number} distance - m from the start of the track
     * @returns {int} the tier at that distance
     */
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
        if (this._state === LightLaneSimulation.COUNTDOWN) {
            this._countdown += dt;
            const total = ((LightLaneTuning.COUNTDOWN_DIGITS.length * LightLaneTuning.COUNTDOWN_DIGIT_TIME) + LightLaneTuning.COUNTDOWN_GO_TIME);
            if (this._countdown >= total) {
                this._state = LightLaneSimulation.RUNNING;
            }
            return;
        }
        if (this._state !== LightLaneSimulation.RUNNING) {
            return;
        }
        this._runTime += dt;
        this._updateSpeed(dt);
        const metres = (this._speed * dt);
        this._z += metres;
        this._score.addDistance(metres, false);
    }

    // A new tier: from the current speed to its target in TIER_RAMP_SECONDS, then a plateau.
    _updateSpeed(dt) {
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
// The countdown's last label; the HUD translates it (hud.go).
LightLaneSimulation.GO        = 'go';
