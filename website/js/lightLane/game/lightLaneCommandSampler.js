/**
 * The only reader of the controls on behalf of the simulation (modelled on RacingCommandSampler): once a frame, the
 * orders of gameplay § 10, on edges only — a key or button that goes down, the gamepad cross, the dominant axis of the
 * stick past its trigger (re-armed under its rest threshold), each swipe — then the timed orders of the test mode's
 * script, due by the run time. A held key never repeats. Outside the run, discard() keeps the edge states up to date
 * and drops everything (a key held through the pause does not fire on resume).
 */
class LightLaneCommandSampler {
    /**
     * @param {LightLaneControls}                     controls
     * @param {{time: number, order: string}[]|null} script - the test mode's timed orders, sorted
     */
    constructor(controls, script = null) {
        this._controls = controls;
        this._readers  = [
            [LightLaneCommandSampler.LEFT, () => controls.readButtonLeft()],
            [LightLaneCommandSampler.RIGHT, () => controls.readButtonRight()],
            [LightLaneCommandSampler.JUMP, () => controls.readButtonJump()],
            [LightLaneCommandSampler.SLIDE, () => controls.readButtonSlide()]
        ];
        this._wasDown    = new Map(this._readers.map(([order]) => [order, true]));
        this._stick      = {x: 0, y: 0};
        this._stickArmed = false;
        this._script     = (script ?? []);
        this._scriptAt   = 0;
    }

    /**
     * @param {number}   runTime - time run so far, s (the script's clock)
     * @param {string[]} out     - emptied, then filled with the orders of this frame, oldest first
     * @returns {string[]} out
     */
    sample(runTime, out) {
        out.length = 0;
        for (const [order, reader] of this._readers) {
            const down = reader();
            if (down && !this._wasDown.get(order)) {
                out.push(order);
            }
            this._wasDown.set(order, down);
        }
        const stickOrder = this._readStick();
        if (stickOrder !== null) {
            out.push(stickOrder);
        }
        for (let swipe = this._controls.pollSwipe(); swipe !== null; swipe = this._controls.pollSwipe()) {
            out.push(LightLaneCommandSampler.SWIPE_ORDERS[swipe]);
        }
        while ((this._scriptAt < this._script.length) && (this._script[this._scriptAt].time <= runTime)) {
            out.push(this._script[this._scriptAt].order);
            this._scriptAt++;
        }

        return out;
    }

    // Outside the run: the edge states read, the orders and the waiting swipes dropped.
    discard() {
        for (const [order, reader] of this._readers) {
            this._wasDown.set(order, reader());
        }
        this._controls.readStick(this._stick);
        this._stickArmed = false;
        this._controls.clearSwipes();

        return this;
    }

    // Script time goes back to 0 with a new run.
    restart() {
        this._scriptAt = 0;
        this.discard();

        return this;
    }

    _readStick() {
        const stick = this._controls.readStick(this._stick);
        const ax    = Math.abs(stick.x);
        const ay    = Math.abs(stick.y);
        if (!this._stickArmed) {
            this._stickArmed = ((ax < LightLaneTuning.STICK_REARM) && (ay < LightLaneTuning.STICK_REARM));
            return null;
        }
        if (Math.max(ax, ay) <= LightLaneTuning.STICK_TRIGGER) {
            return null;
        }
        this._stickArmed = false;
        if (ax > ay) {
            return ((stick.x < 0) ? LightLaneCommandSampler.LEFT : LightLaneCommandSampler.RIGHT);
        }

        return ((stick.y > 0) ? LightLaneCommandSampler.JUMP : LightLaneCommandSampler.SLIDE);
    }
}

LightLaneCommandSampler.LEFT  = 'left';
LightLaneCommandSampler.RIGHT = 'right';
LightLaneCommandSampler.JUMP  = 'jump';
LightLaneCommandSampler.SLIDE = 'slide';
LightLaneCommandSampler.SWIPE_ORDERS = Object.freeze({
    [AppInputSwipe.LEFT]:  LightLaneCommandSampler.LEFT,
    [AppInputSwipe.RIGHT]: LightLaneCommandSampler.RIGHT,
    [AppInputSwipe.UP]:    LightLaneCommandSampler.JUMP,
    [AppInputSwipe.DOWN]:  LightLaneCommandSampler.SLIDE
});
