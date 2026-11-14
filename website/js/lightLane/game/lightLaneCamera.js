/**
 * The camera behind the runner (art § 8): its height follows max(base + share of the feet, feet + margin), its x the
 * runner's, both caught up by 1 − e^(−rate·dt); z a fixed distance behind; pitched down, rolled slightly during a lane
 * change; during a fall it stays at the edge and looks down FALL_LOOK_DOWN in FALL_LOOK_TIME (art § 8). setView()
 * pushes it onto the engine's matrix, with the shake's offset.
 */
class LightLaneCamera {
    constructor() {
        this._x    = 0;
        this._y    = LightLaneTuning.CAMERA_HEIGHT_BASE;
        this._z    = 0;
        this._roll = 0;
        this._fall = -1;   // time since the fall began, < 0 outside a fall
    }

    // A fall: the camera stops at the edge and looks down.
    startFall() {
        this._fall = 0;

        return this;
    }

    /**
     * Straight onto the runner, without catching up (a new run).
     *
     * @param {number} x
     * @param {number} feet
     * @param {number} z
     */
    snap(x, feet, z) {
        this._x    = x;
        this._y    = LightLaneCamera._height(feet);
        this._z    = (z - LightLaneTuning.CAMERA_BACK);
        this._roll = 0;
        this._fall = -1;

        return this;
    }

    /**
     * @param {number} dt       - s
     * @param {number} x        - runner's x
     * @param {number} feet     - runner's feet, y
     * @param {number} z        - runner's z
     * @param {number} laneSide - -1 / +1 while changing lane to the left / right, 0 otherwise
     */
    follow(dt, x, feet, z, laneSide) {
        if (this._fall >= 0) {
            this._fall += dt;
            return this;
        }
        const catchUp = (1 - Math.exp(-LightLaneTuning.CAMERA_FOLLOW_RATE * dt));
        this._x += ((x - this._x) * catchUp);
        this._y += ((LightLaneCamera._height(feet) - this._y) * catchUp);
        this._z  = (z - LightLaneTuning.CAMERA_BACK);
        const roll = (laneSide * LightLaneTuning.CAMERA_ROLL);
        // Eased both ways (not snapped on at the change's start).
        this._roll += ((roll - this._roll) * LightLaneCamera.ease(dt, LightLaneTuning.CAMERA_ROLL_TIME));

        return this;
    }

    /**
     * @param {Engine3d} engine - its matrix set to the camera's view
     * @param {number[]} offset - the shake, added to the camera's place
     */
    setView(engine, offset) {
        engine.matrixIdentity();
        engine.matrixRotateZ(this._roll);
        engine.matrixRotateX(this.getPitch());
        engine.matrixTranslate(-(this._x + offset[0]), -(this._y + offset[1]), -(this._z + offset[2]));

        return this;
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

    // Degrees, about the view axis (setView's matrixRotateZ).
    getRoll() {
        return this._roll;
    }

    // Degrees down (setView's matrixRotateX): CAMERA_PITCH, less the look down of a fall.
    getPitch() {
        const look = ((this._fall < 0) ? 0 : (LightLaneTuning.FALL_LOOK_DOWN * Math.min(1, (this._fall / LightLaneTuning.FALL_LOOK_TIME))));

        return (LightLaneTuning.CAMERA_PITCH - look);
    }

    /**
     * The share of the way to a target covered in dt, the same at any frame rate: 1 − e^(−dt / τ), τ a third of
     * `time` (95 % of the way covered in `time`).
     *
     * @param {number} dt   - s
     * @param {number} time - s
     * @returns {number} 0..1
     */
    static ease(dt, time) {
        return (1 - Math.exp(-(LightLaneCamera.EASE_TIME_CONSTANTS * dt) / time));
    }

    static _height(feet) {
        return Math.max((LightLaneTuning.CAMERA_HEIGHT_BASE + (LightLaneTuning.CAMERA_HEIGHT_FEET * feet)), (feet + LightLaneTuning.CAMERA_ABOVE_FEET));
    }
}

// ease(): 3 time constants, 95 % of the way.
LightLaneCamera.EASE_TIME_CONSTANTS = 3;
