/**
 * The difficulty curve as a function of the distance run (gameplay § 9.1): the tier of a distance, where a tier starts,
 * its target speed, and the start of a run, where the speed rises from START_SPEED_FROM to START_SPEED_TO over the
 * first START_LENGTH metres (user request: a runner speeding up before finding its pace), quickly at first and
 * levelling off: v = from + (to − from) × (1 − (1 − s)²), s = distance / START_LENGTH. Read by the simulation (its
 * speed) and by the generator (the target speed of a row); depends on nothing but the tuning.
 */
class LightLaneDifficulty {
    /**
     * @param {int} tier
     * @returns {number} the distance where the tier starts, m
     */
    static tierStart(tier) {
        const tiers = LightLaneTuning.TIERS;
        if (tier < tiers.length) {
            return tiers[tier].from;
        }

        return (tiers[tiers.length - 1].from + ((tier - (tiers.length - 1)) * LightLaneTuning.TIER_LATE_LENGTH));
    }

    /**
     * @param {int} tier
     * @returns {number} the speed the tier ramps to, m/s
     */
    static tierSpeed(tier) {
        const tiers = LightLaneTuning.TIERS;
        if (tier < tiers.length) {
            return tiers[tier].speed;
        }
        const late = (tiers[tiers.length - 1].speed + ((tier - (tiers.length - 1)) * LightLaneTuning.TIER_LATE_SPEED_STEP));

        return Math.min(LightLaneTuning.SPEED_MAX, late);
    }

    /**
     * @param {number} distance - m
     * @returns {int} the tier of that distance, TIER_LAST at most
     */
    static tierAt(distance) {
        let tier = 0;
        while ((tier < LightLaneTuning.TIER_LAST) && (distance >= LightLaneDifficulty.tierStart(tier + 1))) {
            tier++;
        }

        return tier;
    }

    /**
     * @param {number} distance - m
     * @returns {boolean} still in the start's speed rise
     */
    static isStarting(distance) {
        return (distance < LightLaneTuning.START_LENGTH);
    }

    /**
     * @param {number} distance - m, within the start's rise
     * @returns {number} the speed of the start's rise there, m/s
     */
    static startSpeed(distance) {
        const s    = Math.min(1, Math.max(0, (distance / LightLaneTuning.START_LENGTH)));
        const rise = (1 - ((1 - s) * (1 - s)));

        return (LightLaneTuning.START_SPEED_FROM + ((LightLaneTuning.START_SPEED_TO - LightLaneTuning.START_SPEED_FROM) * rise));
    }

    /**
     * @param {number} distance - m
     * @returns {number} the target speed there: the start's rise, then the tier's speed, m/s
     */
    static targetSpeed(distance) {
        if (LightLaneDifficulty.isStarting(distance)) {
            return LightLaneDifficulty.startSpeed(distance);
        }

        return LightLaneDifficulty.tierSpeed(LightLaneDifficulty.tierAt(distance));
    }
}
