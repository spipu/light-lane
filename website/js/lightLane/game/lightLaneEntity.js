/**
 * One element of the track as the simulation knows it (generation § 1): an obstacle (hurdle, gate, block, gap) with
 * its collision box in world coordinates, or a coin with its centre. Pooled by the generator: reset() before reuse.
 * The presentation reads it (kind, code, lane, x, y, z, length) to draw it.
 */
class LightLaneEntity {
    constructor() {
        this.serial = 0;        // a new number each time the generator takes it (the presentation's link to its instance)
        this.kind   = null;
        this.code   = null;     // LightLaneTuning.OBSTACLES key, or null for a coin
        this.lane   = 0;
        this.x      = 0;        // centre across
        this.y      = 0;        // a coin's height; 0 for an obstacle
        this.z      = 0;        // front face (an obstacle) or centre (a coin)
        this.length = 0;
        this.box    = {x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0};
        this.hit    = false;    // its collision has been dealt with
        this.taken  = false;    // a coin picked up
        this.takenAt = 0;       // run time of the pick-up (the presentation's fade)
    }

    reset() {
        this.kind    = null;
        this.code    = null;
        this.hit     = false;
        this.taken   = false;
        this.takenAt = 0;

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
        const spec  = LightLaneTuning.OBSTACLES[code];
        this.kind   = spec.kind;
        this.code   = code;
        this.lane   = lane;
        this.x      = (lane * LightLaneTuning.LANE_WIDTH);
        this.y      = 0;
        this.z      = z;
        this.length = spec.length;
        const box   = this.box;
        box.x0 = (this.x - spec.halfWidth);
        box.x1 = (this.x + spec.halfWidth);
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
        this.kind   = LightLaneEntity.COIN;
        this.code   = null;
        this.lane   = lane;
        this.x      = (lane * LightLaneTuning.LANE_WIDTH);
        this.y      = y;
        this.z      = z;
        this.length = 0;

        return this;
    }

    // The back of the element, z.
    getEnd() {
        return (this.z + this.length);
    }
}

LightLaneEntity.HURDLE = 'hurdle';
LightLaneEntity.GATE   = 'gate';
LightLaneEntity.BLOCK  = 'block';
LightLaneEntity.GAP    = 'gap';
LightLaneEntity.COIN   = 'coin';
