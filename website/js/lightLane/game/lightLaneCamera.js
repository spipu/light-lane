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
        const back = Math.min(1, (dt / LightLaneTuning.CAMERA_ROLL_BACK_TIME));
        this._roll += ((roll - this._roll) * ((laneSide !== 0) ? 1 : back));

        return this;
    }

    /**
     * @param {Engine3d} engine - its matrix set to the camera's view
     * @param {number[]} offset - the shake, added to the camera's place
     */
    setView(engine, offset) {
        const look = ((this._fall < 0) ? 0 : (LightLaneTuning.FALL_LOOK_DOWN * Math.min(1, (this._fall / LightLaneTuning.FALL_LOOK_TIME))));
        engine.matrixIdentity();
        engine.matrixRotateZ(this._roll);
        engine.matrixRotateX(LightLaneTuning.CAMERA_PITCH - look);
        engine.matrixTranslate(-(this._x + offset[0]), -(this._y + offset[1]), -(this._z + offset[2]));

        return this;
    }

    static _height(feet) {
        return Math.max((LightLaneTuning.CAMERA_HEIGHT_BASE + (LightLaneTuning.CAMERA_HEIGHT_FEET * feet)), (feet + LightLaneTuning.CAMERA_ABOVE_FEET));
    }
}
