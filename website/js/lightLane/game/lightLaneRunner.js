/**
 * The runner's logic (gameplay § 3): its lane and the change between lanes (smoothstep over LANE_CHANGE_TIME), the
 * jump (parabola of height H over T), the fast drop, the slide (kept on under a gate), the queue of one order kept
 * ORDER_KEEP_TIME, the stumble (slower for a while, fragile for FRAGILE_TIME) and its collision box, which never depends
 * on the animation. Asks the simulation whether a lane exists and whether the standing box would cut a gate.
 */
class LightLaneRunner {
    /**
     * @param {{laneExists: function(int): boolean, standingCutsGate: function(): boolean}} world
     */
    constructor(world) {
        this._world = world;
        this.reset();
    }

    reset() {
        this._lane       = 0;
        this._x          = 0;
        this._y          = 0;
        this._fromX      = 0;
        this._toX        = 0;
        this._laneTime   = -1;     // < 0: not changing lane
        this._laneSide   = 0;
        this._originLane = 0;
        this._jumping    = false;
        this._jumpTime   = 0;
        this._jumpHeight = LightLaneTuning.JUMP_HEIGHT;
        this._jumpTotal  = LightLaneTuning.JUMP_TIME;
        this._fastDrop   = false;
        this._slideTime  = 0;      // > 0, or the slide kept on under a gate
        this._sliding    = false;
        this._queued     = null;
        this._queuedAge  = 0;
        this._slowTime   = Infinity;
        this._fragile    = 0;
        this._boots      = false;  // set by the bonus (step 12)

        return this;
    }

    /**
     * One step: the orders received, the queue, the moves.
     *
     * @param {number}          dt
     * @param {string[]|null}   orders - the orders of this frame (first step of the frame only), or null
     * @param {LightLaneEvents} events
     */
    step(dt, orders, events) {
        if (orders !== null) {
            for (const order of orders) {
                this._receive(order, events);
            }
        }
        if (this._queued !== null) {
            this._queuedAge += dt;
            if (this._executable(this._queued)) {
                const order  = this._queued;
                this._queued = null;
                this._execute(order, events);
            } else if (this._queuedAge > LightLaneTuning.ORDER_KEEP_TIME) {
                this._queued = null;
            }
        }
        this._moveAcross(dt);
        this._moveUp(dt, events);
        this._slideOn(dt);
        this._slowTime += dt;
        this._fragile   = Math.max(0, (this._fragile - dt));
    }

    /**
     * A stumble (gameplay § 3.7).
     *
     * @param {boolean} fromSide - entered from the side: a lane change under way is cancelled
     * @returns {boolean} true when it kills (a second stumble while fragile)
     */
    stumble(fromSide) {
        if (this._fragile > 0) {
            return true;
        }
        if (fromSide && (this._laneTime >= 0)) {
            this._fromX    = this._x;
            this._toX      = (this._originLane * LightLaneTuning.LANE_WIDTH);
            this._laneSide = Math.sign(this._toX - this._fromX);
            this._lane     = this._originLane;
            this._laneTime = 0;
        }
        this._slowTime = 0;
        this._fragile  = LightLaneTuning.FRAGILE_TIME;

        return false;
    }

    // Back on its feet on the ground (a landing on a hurdle or a gate: it lands behind it).
    land() {
        this._y        = 0;
        this._jumping  = false;
        this._fastDrop = false;
    }

    /**
     * Dying in a gap: the simulation drives its fall.
     *
     * @param {number} dy - m down
     */
    drop(dy) {
        this._y -= dy;

        return this;
    }

    /**
     * @returns {number} the share of the difficulty's speed it runs at (a stumble slows it, then ramps back)
     */
    getSpeedFactor() {
        const slow = LightLaneTuning.STUMBLE_SLOW;
        if (this._slowTime < LightLaneTuning.STUMBLE_SLOW_TIME) {
            return slow;
        }
        const ramp = ((this._slowTime - LightLaneTuning.STUMBLE_SLOW_TIME) / LightLaneTuning.STUMBLE_RAMP_TIME);

        return ((ramp < 1) ? (slow + ((1 - slow) * ramp)) : 1);
    }

    getLane() {
        return this._lane;
    }

    // Centre across, m.
    getX() {
        return this._x;
    }

    // Feet, m.
    getY() {
        return this._y;
    }

    hasBoots() {
        return this._boots;
    }

    /**
     * @param {boolean} on - the jump boots (the bonus, plan step 12): the next jumps are higher
     */
    setBoots(on) {
        this._boots = on;

        return this;
    }

    isSliding() {
        return this._sliding;
    }

    isJumping() {
        return this._jumping;
    }

    isFragile() {
        return (this._fragile > 0);
    }

    /**
     * @returns {int} -1 / +1 while changing lane to the left / right, 0 otherwise
     */
    getLaneSide() {
        return ((this._laneTime >= 0) ? this._laneSide : 0);
    }

    // Collision box (gameplay § 3.1), the runner's feet at y, its centre at x.
    getHeight() {
        return ((this._sliding) ? LightLaneTuning.RUNNER_SLIDE_HEIGHT : LightLaneTuning.RUNNER_HEIGHT);
    }

    _receive(order, events) {
        if ((order === LightLaneCommandSampler.LEFT) || (order === LightLaneCommandSampler.RIGHT)) {
            const target = (this._lane + ((order === LightLaneCommandSampler.LEFT) ? -1 : 1));
            if (!this._world.laneExists(target)) {
                events.add(LightLaneEvents.REFUSE);
                return;
            }
        }
        if (this._executable(order)) {
            this._execute(order, events);
            return;
        }
        // The latest replaces the older one.
        this._queued    = order;
        this._queuedAge = 0;
    }

    _executable(order) {
        switch (order) {
            case LightLaneCommandSampler.LEFT:
            case LightLaneCommandSampler.RIGHT:
                return ((this._laneTime < 0) && this._world.laneExists(this._lane + ((order === LightLaneCommandSampler.LEFT) ? -1 : 1)));
            case LightLaneCommandSampler.JUMP:
                return (!this._jumping && (!this._sliding || !this._world.standingCutsGate()));
            default:
                return true;
        }
    }

    _execute(order, events) {
        switch (order) {
            case LightLaneCommandSampler.LEFT:
            case LightLaneCommandSampler.RIGHT: {
                const side       = ((order === LightLaneCommandSampler.LEFT) ? -1 : 1);
                this._originLane = this._lane;
                this._lane      += side;
                this._fromX      = this._x;
                this._toX        = (this._lane * LightLaneTuning.LANE_WIDTH);
                this._laneTime   = 0;
                this._laneSide   = side;
                events.add(LightLaneEvents.LANE, side);
                break;
            }
            case LightLaneCommandSampler.JUMP:
                this._sliding    = false;
                this._slideTime  = 0;
                this._jumping    = true;
                this._fastDrop   = false;
                this._jumpTime   = 0;
                this._jumpHeight = ((this._boots) ? LightLaneTuning.JUMP_HEIGHT_BOOTS : LightLaneTuning.JUMP_HEIGHT);
                this._jumpTotal  = ((this._boots) ? LightLaneTuning.JUMP_TIME_BOOTS : LightLaneTuning.JUMP_TIME);
                events.add(LightLaneEvents.JUMP, ((this._boots) ? 1 : 0));
                break;
            default:
                if (this._jumping) {
                    this._fastDrop = true;
                    break;
                }
                this._startSlide(events);
        }
    }

    _startSlide(events) {
        this._sliding   = true;
        this._slideTime = LightLaneTuning.SLIDE_TIME;
        events.add(LightLaneEvents.SLIDE);
    }

    _moveAcross(dt) {
        if (this._laneTime < 0) {
            return;
        }
        this._laneTime += dt;
        const s = Math.min(1, (this._laneTime / LightLaneTuning.LANE_CHANGE_TIME));
        this._x = (this._fromX + ((this._toX - this._fromX) * ((3 * s * s) - (2 * s * s * s))));
        if (s >= 1) {
            this._x        = this._toX;
            this._laneTime = -1;
        }
    }

    _moveUp(dt, events) {
        if (!this._jumping) {
            return;
        }
        this._jumpTime += dt;
        if (this._fastDrop) {
            this._y -= (LightLaneTuning.FAST_DROP_SPEED * dt);
        } else {
            const t = Math.min(1, (this._jumpTime / this._jumpTotal));
            this._y = (4 * this._jumpHeight * t * (1 - t));
        }
        if ((this._y <= 0) || (this._jumpTime >= this._jumpTotal)) {
            const dropped = this._fastDrop;
            this.land();
            events.add(LightLaneEvents.LAND);
            if (dropped) {
                this._startSlide(events);
            }
        }
    }

    // The slide ends after its time, unless the standing box would cut a gate (kept on until it no longer does).
    _slideOn(dt) {
        if (!this._sliding) {
            return;
        }
        this._slideTime -= dt;
        if ((this._slideTime <= 0) && !this._world.standingCutsGate()) {
            this._sliding   = false;
            this._slideTime = 0;
        }
    }
}

LightLaneRunner.DEATH_SHOCK = 'shock';
LightLaneRunner.DEATH_TRIP  = 'trip';
LightLaneRunner.DEATH_FALL  = 'fall';
