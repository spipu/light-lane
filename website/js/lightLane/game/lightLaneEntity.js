/**
 * One element of the track as the simulation knows it (generation § 1): an obstacle (hurdle, gate, block, gap) with
 * its collision box in world coordinates, an enemy (prowler, stalker: gameplay § 6), a coin with its centre, or a bonus
 * (its type in code; drawn and picked up from plan step 12). Pooled by the generator: reset() before reuse. The
 * presentation reads it to draw it.
 *
 * An enemy is laid by its meeting point zm (getZ()); the simulation moves it each step from the runner's z (moveEnemy):
 * its front at zm + ENEMY_SPEED_SHARE × (zm − zRunner), so it reaches zm exactly when the runner does; a stalker moves
 * across to its lane of destination by the time left to the meeting (τ). Its box of the step before is kept: the
 * collision is tested in relative positions (gameplay § 5.1).
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
        this._toLane  = 0;        // an enemy's lane at the meeting (a stalker's destination)
        this._front   = 0;        // an enemy's moving front, z
        this._warn    = false;    // a stalker announcing its move
        this._heading = 0;        // the angle of a stalker's path while it moves across, degrees (+: towards +x); its lean
        this._prevBox = {x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0};
    }

    reset() {
        this._warn    = false;
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
        this._toLane = (lane + (spec.side ?? 0));
        this._front  = z;
        this._warn   = false;
        this._heading = 0;
        LightLaneEntity._copyBox(this._prevBox, box);

        return this;
    }

    /**
     * An enemy moved for the runner at zRunner (the box of the step before kept).
     *
     * @param {number} zRunner
     * @param {number} speed   - the runner's real speed, m/s (a stalker's τ)
     */
    moveEnemy(zRunner, speed) {
        const spec = LightLaneTuning.OBSTACLES[this._code];
        LightLaneEntity._copyBox(this._prevBox, this._box);
        this._front = (this._z + (LightLaneTuning.ENEMY_SPEED_SHARE * (this._z - zRunner)));
        let x       = (this._lane * LightLaneTuning.LANE_WIDTH);
        if (this._kind === LightLaneEntity.STALKER) {
            const ahead = Math.max(speed, LightLaneEntity.MIN_SPEED);
            const tau   = ((this._z - zRunner) / ahead);
            const s     = Math.min(1, Math.max(0, ((LightLaneTuning.STALKER_MOVE - tau) / LightLaneTuning.STALKER_MOVE_TIME)));
            const ease  = ((3 * s * s) - (2 * s * s * s));
            const width = ((this._toLane - this._lane) * LightLaneTuning.LANE_WIDTH);
            x           = (x + (width * ease));
            this._warn  = ((tau <= LightLaneTuning.STALKER_WARN) && (s < 1));
            // Its sideways speed (the S-curve's slope over the move's time) against its own speed ahead.
            const across  = ((width * 6 * s * (1 - s)) / LightLaneTuning.STALKER_MOVE_TIME);
            this._heading = (Math.atan2(across, (LightLaneTuning.ENEMY_SPEED_SHARE * ahead)) * LightLaneEntity.DEGREES);
        }
        this._x  = x;
        const box = this._box;
        box.x0 = (x - spec.halfWidth);
        box.x1 = (x + spec.halfWidth);
        box.z0 = (this._front + spec.z0);
        box.z1 = (this._front + spec.z1);
    }

    /**
     * @param {LightLaneEntity} other
     * @returns {LightLaneEntity} this, a copy of other (the robot's copies of the simulation)
     */
    copyFrom(other) {
        this._serial  = other._serial;
        this._kind    = other._kind;
        this._code    = other._code;
        this._lane    = other._lane;
        this._x       = other._x;
        this._y       = other._y;
        this._z       = other._z;
        this._length  = other._length;
        this._hit     = other._hit;
        this._taken   = other._taken;
        this._takenAt = other._takenAt;
        this._takenDz = other._takenDz;
        this._toLane  = other._toLane;
        this._front   = other._front;
        this._warn    = other._warn;
        this._heading = other._heading;
        LightLaneEntity._copyBox(this._box, other._box);
        LightLaneEntity._copyBox(this._prevBox, other._prevBox);

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

    // The back of the element, z (an enemy: of its meeting point).
    getEnd() {
        return (this._z + this._length);
    }

    // An obstacle (it blocks, makes trip or swallows), an enemy included; not something to pick up.
    isObstacle() {
        return ((this._kind !== LightLaneEntity.COIN) && (this._kind !== LightLaneEntity.BONUS));
    }

    isEnemy() {
        return ((this._kind === LightLaneEntity.PROWLER) || (this._kind === LightLaneEntity.STALKER));
    }

    // An enemy's lane at the meeting (a stalker's destination; the lane itself otherwise).
    getToLane() {
        return this._toLane;
    }

    // An enemy's moving front, z.
    getFront() {
        return this._front;
    }

    // The angle of a stalker's path while it moves across, degrees, + towards +x (0 on its lanes): what its lean follows.
    getHeading() {
        return this._heading;
    }

    // A stalker announcing its move (chevrons, arrow).
    isWarning() {
        return this._warn;
    }

    /**
     * @returns {{x0: number, x1: number, y0: number, y1: number, z0: number, z1: number}} an enemy's box on the step
     *          before (read only)
     */
    getPrevBox() {
        return this._prevBox;
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

    static _copyBox(out, box) {
        out.x0 = box.x0;
        out.x1 = box.x1;
        out.y0 = box.y0;
        out.y1 = box.y1;
        out.z0 = box.z0;
        out.z1 = box.z1;
    }

    _setPoint(kind, code, lane, y, z) {
        this._toLane = lane;
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
LightLaneEntity.PROWLER = 'prowler';
LightLaneEntity.STALKER = 'stalker';
// A stalker's τ divides by the speed: at least this (the countdown's standstill).
LightLaneEntity.MIN_SPEED = 0.1;
LightLaneEntity.DEGREES   = (180 / Math.PI);
