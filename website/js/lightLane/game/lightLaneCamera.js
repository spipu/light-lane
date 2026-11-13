/**
 * The camera behind the runner (art § 8): its height follows max(base + share of the feet, feet + margin), its x the
 * runner's, both caught up by 1 − e^(−rate·dt); z a fixed distance behind; pitched down, rolled slightly during a lane
 * change. setView() pushes it onto the engine's matrix.
 */
class LightLaneCamera {
    constructor() {
        this._x    = 0;
        this._y    = LightLaneTuning.CAMERA_HEIGHT_BASE;
        this._z    = 0;
        this._roll = 0;
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
     */
    setView(engine) {
        engine.matrixIdentity();
        engine.matrixRotateZ(this._roll);
        engine.matrixRotateX(LightLaneTuning.CAMERA_PITCH);
        engine.matrixTranslate(-this._x, -this._y, -this._z);

        return this;
    }

    static _height(feet) {
        return Math.max((LightLaneTuning.CAMERA_HEIGHT_BASE + (LightLaneTuning.CAMERA_HEIGHT_FEET * feet)), (feet + LightLaneTuning.CAMERA_ABOVE_FEET));
    }
}
