/**
 * The seeded random source of the run (gameplay § 1): mulberry32, 32-bit state; the same seed plays the same track.
 */
class LightLaneRandom {
    /**
     * @param {int} seed
     */
    constructor(seed) {
        this._state = (seed >>> 0);
    }

    /**
     * @returns {number} uniform in [0, 1)
     */
    next() {
        this._state = ((this._state + 0x6D2B79F5) >>> 0);
        let t = this._state;
        t = Math.imul((t ^ (t >>> 15)), (t | 1));
        t ^= (t + Math.imul((t ^ (t >>> 7)), (t | 61)));

        return (((t ^ (t >>> 14)) >>> 0) / LightLaneRandom.RANGE);
    }

    /**
     * @param {number} min
     * @param {number} max
     * @returns {number} uniform in [min, max)
     */
    between(min, max) {
        return (min + ((max - min) * this.next()));
    }

    /**
     * @param {int} min
     * @param {int} max
     * @returns {int} uniform in [min, max], both included
     */
    integer(min, max) {
        return (min + Math.floor(this.next() * ((max - min) + 1)));
    }

    /**
     * @param {number} probability
     * @returns {boolean}
     */
    chance(probability) {
        return (this.next() < probability);
    }

    // A seed for a new run.
    static freshSeed() {
        return (Date.now() >>> 0);
    }
}

LightLaneRandom.RANGE = 4294967296;
