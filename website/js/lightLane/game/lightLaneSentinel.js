/**
 * The Sentinel (gameplay § 7), in the simulation: a pass started when the runner reaches the z the generator planned
 * (LightLaneTrackGenerator.takeSentinel): it arrives from behind and above (S-curve), stays ahead of the runner over
 * its lane, attacks three times, then leaves. One attack at a time:
 * - strike (red, deadly): the lane the runner is on (its lane of arrival in a lane change) is marked, then a column
 *   falls on it: deadly when the runner's box is within ±STRIKE_HALF_WIDTH of the lane's centre, whatever its height;
 * - sweep (orange, low or high): a frame announces it ahead, then a ray comes at SWEEP_SPEED relative: a stumble when it
 *   crosses the runner's box at its height (jump a low one, slide under a high one).
 * Positions relative to the runner, who keeps running: the step reads the runner's z. Its own random source (seeded from
 * the run's) draws the attacks. No box of its own: nothing touches it. No allocation per step.
 */
class LightLaneSentinel {
    constructor() {
        this._random    = new LightLaneRandom(0);
        this._attacks   = [null, null, null];   // the pass's attack types
        this.reset(0);
    }

    /**
     * @param {int} seed - the run's
     * @returns {LightLaneSentinel} this
     */
    reset(seed) {
        this._random    = new LightLaneRandom(seed ^ LightLaneSentinel.SEED);
        this._phase     = LightLaneSentinel.AWAY;
        this._time      = 0;
        this._x         = 0;
        this._y         = 0;
        this._ahead     = 0;       // z ahead of the runner
        this._lastSweep = null;
        this._attack    = null;    // the attack under way: a type, or null
        this._index     = -1;
        this._attackT   = 0;       // time since the attack started
        this._aimX      = 0;       // a strike's lane centre
        this._sweepD    = 0;       // a sweep's ray, z relative to the runner
        this._hit       = false;   // the attack under way has done its harm
        this._attacks[0] = null;
        this._attacks[1] = null;
        this._attacks[2] = null;

        return this;
    }

    /**
     * @param {LightLaneSentinel} other
     * @returns {LightLaneSentinel} this, a copy of other (the robot)
     */
    copyFrom(other) {
        this._random.copyFrom(other._random);
        this._phase     = other._phase;
        this._time      = other._time;
        this._x         = other._x;
        this._y         = other._y;
        this._ahead     = other._ahead;
        this._lastSweep = other._lastSweep;
        this._attack    = other._attack;
        this._index     = other._index;
        this._attackT   = other._attackT;
        this._aimX      = other._aimX;
        this._sweepD    = other._sweepD;
        this._hit       = other._hit;
        for (let i = 0; i < this._attacks.length; i++) {
            this._attacks[i] = other._attacks[i];
        }

        return this;
    }

    /**
     * A pass starts: its three attacks drawn (strike STRIKE_CHANCE, else a sweep, never two sweeps of the same height in
     * a row).
     *
     * @param {number} runnerX
     */
    start(runnerX) {
        this._phase  = LightLaneSentinel.ARRIVE;
        this._time   = 0;
        this._x      = runnerX;
        this._attack = null;
        this._index  = -1;
        for (let i = 0; i < this._attacks.length; i++) {
            let type = LightLaneSentinel.STRIKE;
            if (!this._random.chance(LightLaneTuning.STRIKE_CHANCE)) {
                type = ((this._random.chance(LightLaneTuning.SWEEP_LOW_CHANCE)) ? LightLaneSentinel.SWEEP_LOW : LightLaneSentinel.SWEEP_HIGH);
                if (type === this._lastSweep) {
                    type = ((type === LightLaneSentinel.SWEEP_LOW) ? LightLaneSentinel.SWEEP_HIGH : LightLaneSentinel.SWEEP_LOW);
                }
                this._lastSweep = type;
            }
            this._attacks[i] = type;
        }
        this._place(0, runnerX);
    }

    /**
     * A step of the pass and of its attack.
     *
     * @param {number}          dt
     * @param {LightLaneRunner} runner
     * @param {LightLaneEvents} events
     * @returns {string|null} what it does to the runner: LightLaneSentinel.KILL, STUMBLE, or null
     */
    step(dt, runner, events) {
        if (this._phase === LightLaneSentinel.AWAY) {
            return null;
        }
        this._time += dt;
        this._advancePhase();
        this._place(dt, runner.getX());
        if (this._phase !== LightLaneSentinel.PRESENT) {
            return null;
        }
        const attacks = LightLaneTuning.SENTINEL_ATTACKS;
        if (((this._index + 1) < attacks.length) && (this._time >= attacks[this._index + 1])) {
            this._index++;
            this._attack  = this._attacks[this._index];
            this._attackT = 0;
            this._hit     = false;
            this._aimX    = (runner.getLane() * LightLaneTuning.LANE_WIDTH);
            this._sweepD  = LightLaneTuning.SWEEP_AHEAD;
            events.add(LightLaneEvents.ANNOUNCE, this._attack);
            return null;
        }
        if (this._attack === null) {
            return null;
        }
        this._attackT += dt;

        return ((this._attack === LightLaneSentinel.STRIKE) ? this._strike(runner, events) : this._sweep(runner));
    }

    isActive() {
        return (this._phase !== LightLaneSentinel.AWAY);
    }

    // Its centre (the wing's), x and y; z relative to the runner.
    getX() {
        return this._x;
    }

    getY() {
        return this._y;
    }

    getAhead() {
        return this._ahead;
    }

    /**
     * @returns {string|null} the attack under way (STRIKE, SWEEP_LOW, SWEEP_HIGH) while it shows, or null
     */
    getAttack() {
        return this._attack;
    }

    // Time since the attack under way started, s.
    getAttackTime() {
        return this._attackT;
    }

    // A strike's lane centre, x.
    getAimX() {
        return this._aimX;
    }

    // A sweep's ray, z relative to the runner (SWEEP_AHEAD while it is announced).
    getSweepAhead() {
        return this._sweepD;
    }

    _advancePhase() {
        if ((this._phase === LightLaneSentinel.ARRIVE) && (this._time >= LightLaneTuning.SENTINEL_ARRIVE)) {
            this._phase = LightLaneSentinel.PRESENT;
            this._time -= LightLaneTuning.SENTINEL_ARRIVE;
        } else if ((this._phase === LightLaneSentinel.PRESENT) && (this._time >= LightLaneTuning.SENTINEL_PRESENT)) {
            this._phase  = LightLaneSentinel.LEAVE;
            this._time  -= LightLaneTuning.SENTINEL_PRESENT;
            this._attack = null;
        } else if ((this._phase === LightLaneSentinel.LEAVE) && (this._time >= LightLaneTuning.SENTINEL_LEAVE_TIME)) {
            this._phase  = LightLaneSentinel.AWAY;
            this._time   = 0;
        }
    }

    // Where it flies (§ 7.1): an S-curve from behind and above, bobbing ahead over the runner's lane, away ahead and up.
    _place(dt, runnerX) {
        const [atY, atZ] = LightLaneTuning.SENTINEL_AT;
        if (this._phase === LightLaneSentinel.ARRIVE) {
            const s      = Math.min(1, (this._time / LightLaneTuning.SENTINEL_ARRIVE));
            const ease   = ((3 * s * s) - (2 * s * s * s));
            const [y, z] = LightLaneTuning.SENTINEL_FROM;
            this._y      = (y + ((atY - y) * ease));
            this._ahead  = (z + ((atZ - z) * ease));
            this._x      = ((runnerX * ease) + (LightLaneTuning.SENTINEL_SWAY * Math.sin(2 * Math.PI * ease)));
            return;
        }
        if (this._phase === LightLaneSentinel.PRESENT) {
            this._y     = (atY + (LightLaneTuning.SENTINEL_BOB * Math.sin(2 * Math.PI * LightLaneTuning.SENTINEL_BOB_HZ * this._time)));
            this._ahead = atZ;
            this._x    += ((runnerX - this._x) * (1 - Math.exp(-LightLaneTuning.SENTINEL_FOLLOW * dt)));
            return;
        }
        if (this._phase === LightLaneSentinel.LEAVE) {
            const s      = Math.min(1, (this._time / LightLaneTuning.SENTINEL_LEAVE_TIME));
            const [y, z] = LightLaneTuning.SENTINEL_LEAVE;
            this._y      = (atY + (y * s * s));
            this._ahead  = (atZ + (z * s * s));
        }
    }

    // Marked STRIKE_WARN, then the column for STRIKE_TIME, then its trace for STRIKE_TRACE.
    _strike(runner, events) {
        const fire = LightLaneTuning.STRIKE_WARN;
        const t    = this._attackT;
        if (t >= (fire + LightLaneTuning.STRIKE_TIME + LightLaneTuning.STRIKE_TRACE)) {
            this._attack = null;
            return null;
        }
        if ((t < fire) || (t >= (fire + LightLaneTuning.STRIKE_TIME)) || this._hit) {
            return null;
        }
        if (!this._hit && ((t - LightLaneTuning.STEP_SECONDS) < fire)) {
            events.add(LightLaneEvents.STRIKE);
        }
        const x    = runner.getX();
        const half = LightLaneTuning.RUNNER_HALF_WIDTH;
        if (((x + half) > (this._aimX - LightLaneTuning.STRIKE_HALF_WIDTH)) && ((x - half) < (this._aimX + LightLaneTuning.STRIKE_HALF_WIDTH))) {
            this._hit = true;
            return LightLaneSentinel.KILL;
        }

        return null;
    }

    // Announced SWEEP_WARN at SWEEP_AHEAD, then the ray comes at SWEEP_SPEED relative, gone SWEEP_PAST behind.
    _sweep(runner) {
        const travel = (this._attackT - LightLaneTuning.SWEEP_WARN);
        if (travel < 0) {
            return null;
        }
        const before = this._sweepD;
        this._sweepD = (LightLaneTuning.SWEEP_AHEAD - (LightLaneTuning.SWEEP_SPEED * travel));
        if (this._sweepD < -LightLaneTuning.SWEEP_PAST) {
            this._attack = null;
            return null;
        }
        if (this._hit) {
            return null;
        }
        // The ray's thin box swept between the steps against the runner's depth, then its height.
        const depth    = (LightLaneTuning.SWEEP_DEPTH / 2);
        const half     = LightLaneTuning.RUNNER_HALF_DEPTH;
        const [y0, y1] = LightLaneTuning.SWEEP_BOX[LightLaneSentinel.HEIGHT[this._attack]];
        const feet     = runner.getY();
        const crosses  = (((this._sweepD - depth) < half) && ((before + depth) > -half));
        if (crosses && (feet < y1) && ((feet + runner.getHeight()) > y0)) {
            this._hit = true;
            return LightLaneSentinel.STUMBLE;
        }

        return null;
    }
}

LightLaneSentinel.AWAY       = 'away';
LightLaneSentinel.ARRIVE     = 'arrive';
LightLaneSentinel.PRESENT    = 'present';
LightLaneSentinel.LEAVE      = 'leave';
LightLaneSentinel.STRIKE     = 'strike';
LightLaneSentinel.SWEEP_LOW  = 'sweepLow';
LightLaneSentinel.SWEEP_HIGH = 'sweepHigh';
LightLaneSentinel.KILL       = 'kill';
LightLaneSentinel.STUMBLE    = 'stumble';
// A sweep's height: its key in SWEEP_BOX and SWEEP_DRAWN.
LightLaneSentinel.HEIGHT     = Object.freeze({sweepLow: 'low', sweepHigh: 'high'});
// Its random source: seeded from the run's.
LightLaneSentinel.SEED       = 0x3E71;
