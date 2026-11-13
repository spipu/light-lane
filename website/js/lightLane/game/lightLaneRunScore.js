/**
 * The score of the run under way (gameplay § 12): 1 point a metre (× 2 under the double score), the coins' points,
 * the coins picked up; the distance points kept as a float, shown rounded down.
 */
class LightLaneRunScore {
    constructor() {
        this._distancePoints = 0;
        this._coinPoints     = 0;
        this._coins          = 0;
    }

    reset() {
        this._distancePoints = 0;
        this._coinPoints     = 0;
        this._coins          = 0;

        return this;
    }

    /**
     * @param {number}  metres
     * @param {boolean} doubled - the double score is on
     */
    addDistance(metres, doubled) {
        this._distancePoints += (metres * ((doubled) ? LightLaneRunScore.DOUBLE : 1));

        return this;
    }

    /**
     * @param {int}     points  - the coin's value
     * @param {boolean} doubled - the double score is on
     */
    addCoin(points, doubled) {
        this._coins++;
        this._coinPoints += (points * ((doubled) ? LightLaneRunScore.DOUBLE : 1));

        return this;
    }

    /**
     * @returns {int} the score shown
     */
    getScore() {
        return Math.floor(this._distancePoints + this._coinPoints);
    }

    getCoins() {
        return this._coins;
    }
}

LightLaneRunScore.DOUBLE = 2;
