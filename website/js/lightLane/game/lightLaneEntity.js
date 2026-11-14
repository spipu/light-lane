/**
 * One element of the track as the simulation knows it (generation § 1): an obstacle (hurdle, gate, block, gap) with
 * its collision box in world coordinates, a coin with its centre, or a bonus (its type in code; drawn and picked up from
 * plan step 12). Pooled by the generator: reset() before reuse. The presentation reads it to draw it.
 */
class LightLaneEntity {
    constructor() {
        this._serial  = 0;        // a new number each time the generator takes it (the presentation's link to its instance)
        this._kind    = null;
        this._code    = null;     // LightLaneTuning.OBSTACLES key, a bonus type, or null for a coin
        this._lane    = 0;
        this._x       = 0;        // centre across
        this._y       = 0;        // a coin's or a bonus's height; 0 for an obstacle
        this._z       = 0;        // front face (an obstacle) or centre (a coin, a bonus)
        this._length  = 0;
        this._box     = {x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0};
        this._hit     = false;    // its collision has been dealt with
        this._taken   = false;    // a coin picked up
        this._takenAt = 0;        // run time of the pick-up (the presentation's fade)
        this._takenDz = 0;        // the coin's z less the runner's at the pick-up (it then goes on with the runner)
    }

    reset() {
        this._kind    = null;
        this._code    = null;
        this._hit     = false;
        this._taken   = false;
        this._takenAt = 0;
        this._takenDz = 0;

        return this;
    }

    /**
     * @param {int} serial
     * @returns {LightLaneEntity} this
     */
    setSerial(serial) {
        this._serial = serial;

        return this;
    }

    /**
     * An obstacle of the given code, its front face at z.
     *
     * @param {string} code - LightLaneTuning.OBSTACLES key
     * @param {int}    lane
     * @param {number} z
     */
    setObstacle(code, lane, z) {
        const spec   = LightLaneTuning.OBSTACLES[code];
        this._kind   = spec.kind;
        this._code   = code;
        this._lane   = lane;
        this._x      = (lane * LightLaneTuning.LANE_WIDTH);
        this._y      = 0;
        this._z      = z;
        this._length = spec.length;
        const box    = this._box;
        box.x0 = (this._x - spec.halfWidth);
        box.x1 = (this._x + spec.halfWidth);
        box.y0 = spec.y0;
        box.y1 = spec.y1;
        box.z0 = (z + spec.z0);
        box.z1 = (z + ((spec.z1 < 0) ? (spec.length + spec.z1) : spec.z1));

        return this;
    }

    /**
     * @param {int}    lane
     * @param {number} y
     * @param {number} z
     */
    setCoin(lane, y, z) {
        return this._setPoint(LightLaneEntity.COIN, null, lane, y, z);
    }

    /**
     * @param {string} type - LightLaneTuning.BONUS_TYPES key
     * @param {int}    lane
     * @param {number} z
     */
    setBonus(type, lane, z) {
        return this._setPoint(LightLaneEntity.BONUS, type, lane, LightLaneTuning.BONUS_HEIGHT, z);
    }

    getSerial() {
        return this._serial;
    }

    getKind() {
        return this._kind;
    }

    getCode() {
        return this._code;
    }

    getLane() {
        return this._lane;
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

    getLength() {
        return this._length;
    }

    /**
     * @returns {{x0: number, x1: number, y0: number, y1: number, z0: number, z1: number}} read only
     */
    getBox() {
        return this._box;
    }

    // The back of the element, z.
    getEnd() {
        return (this._z + this._length);
    }

    // An obstacle (it blocks, makes trip or swallows), not something to pick up.
    isObstacle() {
        return ((this._kind !== LightLaneEntity.COIN) && (this._kind !== LightLaneEntity.BONUS));
    }

    isHit() {
        return this._hit;
    }

    markHit() {
        this._hit = true;
    }

    isTaken() {
        return this._taken;
    }

    getTakenAt() {
        return this._takenAt;
    }

    getTakenDz() {
        return this._takenDz;
    }

    /**
     * @param {number} time - run time of the pick-up
     * @param {number} dz   - its z less the runner's
     */
    take(time, dz) {
        this._taken   = true;
        this._takenAt = time;
        this._takenDz = dz;
    }

    _setPoint(kind, code, lane, y, z) {
        this._kind   = kind;
        this._code   = code;
        this._lane   = lane;
        this._x      = (lane * LightLaneTuning.LANE_WIDTH);
        this._y      = y;
        this._z      = z;
        this._length = 0;

        return this;
    }
}

LightLaneEntity.HURDLE = 'hurdle';
LightLaneEntity.GATE   = 'gate';
LightLaneEntity.BLOCK  = 'block';
LightLaneEntity.GAP    = 'gap';
LightLaneEntity.COIN   = 'coin';
LightLaneEntity.BONUS  = 'bonus';
