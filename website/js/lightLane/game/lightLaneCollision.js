/**
 * Collision tests of gameplay § 5, axis-aligned boxes, without allocation. The runner's box is swept in z over the
 * step ([zPrevious − half depth, zCurrent + half depth]), x and y taken at the end of the step; an overlapped box is
 * classified by the runner's position on the previous step, the first axis separated in the order z, x, y (§ 5.2).
 */
class LightLaneCollision {
    /**
     * @param {object} a - {x0, x1, y0, y1, z0, z1}
     * @param {object} b - same
     * @returns {boolean} the boxes overlap (touching faces do not)
     */
    static overlaps(a, b) {
        return ((a.x0 < b.x1) && (b.x0 < a.x1) && (a.y0 < b.y1) && (b.y0 < a.y1) && (a.z0 < b.z1) && (b.z0 < a.z1));
    }

    /**
     * The runner's box written into out.
     *
     * @param {object} out
     * @param {number} x       - centre
     * @param {number} y       - feet
     * @param {number} height
     * @param {number} zFrom   - centre, start of the sweep
     * @param {number} zTo     - centre, end of the sweep
     * @param {number} reach   - added on every side (a coin's pick-up reach), 0 for a collision
     * @returns {object} out
     */
    static runnerBox(out, x, y, height, zFrom, zTo, reach = 0) {
        const halfWidth = (LightLaneTuning.RUNNER_HALF_WIDTH + reach);
        const halfDepth = (LightLaneTuning.RUNNER_HALF_DEPTH + reach);
        out.x0 = (x - halfWidth);
        out.x1 = (x + halfWidth);
        out.y0 = (y - reach);
        out.y1 = (y + height + reach);
        out.z0 = (Math.min(zFrom, zTo) - halfDepth);
        out.z1 = (Math.max(zFrom, zTo) + halfDepth);

        return out;
    }

    /**
     * @param {object} previous - the runner's box on the previous step (not swept)
     * @param {object} box      - the element's box, overlapped now
     * @returns {string} LightLaneCollision.FRONT, SIDE, TOP, BELOW or NONE (it was already inside)
     */
    static entry(previous, box) {
        if ((previous.z1 <= box.z0) || (previous.z0 >= box.z1)) {
            return LightLaneCollision.FRONT;
        }
        if ((previous.x1 <= box.x0) || (previous.x0 >= box.x1)) {
            return LightLaneCollision.SIDE;
        }
        if (previous.y0 >= box.y1) {
            return LightLaneCollision.TOP;
        }
        if (previous.y1 <= box.y0) {
            return LightLaneCollision.BELOW;
        }

        return LightLaneCollision.NONE;
    }

    /**
     * What an entry does to the runner (gameplay § 5.2).
     *
     * @param {string} kind  - LightLaneEntity.HURDLE, GATE, BLOCK, PROWLER or STALKER (a block or an enemy from the top: a shock)
     * @param {string} entry - LightLaneCollision constant
     * @returns {string} LightLaneCollision.DEATH, STUMBLE, STUMBLE_LAND (on its feet behind it) or IGNORE
     */
    static outcome(kind, entry) {
        switch (entry) {
            case LightLaneCollision.FRONT:
                return LightLaneCollision.DEATH;
            case LightLaneCollision.SIDE:
                return LightLaneCollision.STUMBLE;
            case LightLaneCollision.TOP:
                return (((kind === LightLaneEntity.HURDLE) || (kind === LightLaneEntity.GATE)) ? LightLaneCollision.STUMBLE_LAND : LightLaneCollision.DEATH);
            default:
                return LightLaneCollision.IGNORE;
        }
    }

    /**
     * A gap swallows the runner whose feet are at most at its box's top and whose centre is over its box.
     *
     * @param {object} box
     * @param {number} x - centre
     * @param {number} y - feet
     * @param {number} z - centre
     * @returns {boolean}
     */
    static fallsInto(box, x, y, z) {
        return ((y <= box.y1) && (x > box.x0) && (x < box.x1) && (z > box.z0) && (z < box.z1));
    }

    /**
     * @param {object} box      - the runner's box with the pick-up reach
     * @param {LightLaneEntity} coin
     * @returns {boolean} the coin's centre is inside
     */
    static picks(box, coin) {
        const x = coin.getX();
        const y = coin.getY();
        const z = coin.getZ();

        return ((x >= box.x0) && (x <= box.x1) && (y >= box.y0) && (y <= box.y1) && (z >= box.z0) && (z <= box.z1));
    }
}

LightLaneCollision.FRONT        = 'front';
LightLaneCollision.SIDE         = 'side';
LightLaneCollision.TOP          = 'top';
LightLaneCollision.BELOW        = 'below';
LightLaneCollision.NONE         = 'none';
LightLaneCollision.DEATH        = 'death';
LightLaneCollision.STUMBLE      = 'stumble';
LightLaneCollision.STUMBLE_LAND = 'stumbleLand';
LightLaneCollision.IGNORE       = 'ignore';
