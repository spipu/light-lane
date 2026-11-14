/**
 * The robot (tech § 8.1): it plays the real simulation with a human's latency, for the bench (the fairness of the
 * generated track, generation § 8.3) and the test mode's `pilot`. Every ROBOT_STEP of run time, at t: it takes the run as
 * it will be at t + ROBOT_LATENCY with the orders it already gave, tries each order (none, left, right, jump, slide)
 * followed by each order again ROBOT_STEP later (25 branches), each branch played ROBOT_HORIZON after the latency;
 * a death scores −ROBOT_DEATH plus the time it was put off (when every branch dies within the horizon, the longest
 * reprieve is taken: the next decisions, which see further, may find the way out a two-order branch cannot hold), a
 * stumble −ROBOT_STUMBLE, a coin +1; a first order is worth its best branch plus ROBOT_SAFETY for
 * each of its second orders that lives without a stumble (a choice that leaves several ways open beats one that
 * leaves a single last-moment escape: without it, the robot put off its move until its latency made it too late); the
 * best first order is given at t + ROBOT_LATENCY. Plays
 * copies (LightLaneSimulation.copyFrom): no allocation once its copies have grown to the run's size.
 */
class LightLaneRobot {
    constructor() {
        this._ahead   = new LightLaneSimulation();
        this._first   = new LightLaneSimulation();
        this._branch  = new LightLaneSimulation();
        this._queue   = [];      // orders given, due at their time: {time, order}
        this._spare   = [];
        this._orders  = [];      // the orders of a step of a copy, reused
        this._next    = 0;       // run time of the next decision
        this._outcome = {dead: false, stumbles: 0, coins: 0, time: 0};
    }

    // A new run.
    reset() {
        while (this._queue.length > 0) {
            this._spare.push(this._queue.pop());
        }
        this._next = 0;

        return this;
    }

    /**
     * Before a step (or a frame) of the run: decides when its time has come, adds the orders now due to `out`.
     *
     * @param {LightLaneSimulation} simulation
     * @param {string[]}            out
     */
    update(simulation, out) {
        if (simulation.getState() !== LightLaneSimulation.RUNNING) {
            return;
        }
        const now = simulation.getRunTime();
        while ((now + LightLaneRobot.EPSILON) >= this._next) {
            this._decide(simulation, now);
            this._next += LightLaneTuning.ROBOT_STEP;
        }
        while ((this._queue.length > 0) && (this._queue[0].time <= (now + LightLaneRobot.EPSILON))) {
            const due = this._queue.shift();
            out.push(due.order);
            this._spare.push(due);
        }
    }

    _decide(simulation, now) {
        const step    = LightLaneTuning.ROBOT_STEP;
        const horizon = (LightLaneTuning.ROBOT_HORIZON - step);
        this._ahead.copyFrom(simulation);
        if (this._play(this._ahead, LightLaneTuning.ROBOT_LATENCY, null, true).dead) {
            // Lost whatever it does now: nothing to give.
            return;
        }
        let best      = null;
        let bestScore = -Infinity;
        for (const first of LightLaneRobot.ORDERS) {
            this._first.copyFrom(this._ahead);
            const value = this._value(first, step, horizon);
            if (value > bestScore) {
                bestScore = value;
                best      = first;
            }
        }
        if (best === null) {
            // Doing nothing is its best: nothing to give.
            return;
        }
        const due = ((this._spare.length > 0) ? this._spare.pop() : {time: 0, order: null});
        due.time  = (now + LightLaneTuning.ROBOT_LATENCY);
        due.order = best;
        this._queue.push(due);
    }

    // A first order's worth: its best branch (a death: −ROBOT_DEATH + its reprieve) plus ROBOT_SAFETY a safe branch.
    _value(first, step, horizon) {
        const one = this._play(this._first, step, first, false);
        if (one.dead) {
            return (one.time - LightLaneTuning.ROBOT_DEATH);
        }
        const oneStumbles = one.stumbles;
        const oneCoins    = one.coins;
        const oneTime     = one.time;
        let best          = -Infinity;
        let safe          = 0;
        for (const second of LightLaneRobot.ORDERS) {
            this._branch.copyFrom(this._first);
            const two = this._play(this._branch, horizon, second, false);
            if (two.dead) {
                best = Math.max(best, ((oneTime + two.time) - LightLaneTuning.ROBOT_DEATH));
                continue;
            }
            const stumbles = (oneStumbles + two.stumbles);
            best  = Math.max(best, ((oneCoins + two.coins) - (LightLaneTuning.ROBOT_STUMBLE * stumbles)));
            safe += ((stumbles === 0) ? 1 : 0);
        }

        return (best + (LightLaneTuning.ROBOT_SAFETY * safe));
    }

    /**
     * Plays a copy for `duration`: `order` given at its first step; `queued`: the orders already given, at their time.
     *
     * @returns {{dead: boolean, stumbles: int, coins: int, time: number}} reused; time: played until the death, or all of it
     */
    _play(copy, duration, order, queued) {
        const outcome  = this._outcome;
        const steps    = Math.round(duration / LightLaneTuning.STEP_SECONDS);
        const deaths   = copy.getShieldDeaths();
        const coins    = copy.getScore().getCoins();
        const orders   = this._orders;
        let next       = 0;
        outcome.dead     = false;
        outcome.stumbles = 0;
        outcome.time     = duration;
        for (let i = 0; i < steps; i++) {
            orders.length = 0;
            if ((i === 0) && (order !== null)) {
                orders.push(order);
            }
            while (queued && (next < this._queue.length) && (this._queue[next].time <= (copy.getRunTime() + LightLaneRobot.EPSILON))) {
                orders.push(this._queue[next++].order);
            }
            copy.advance(LightLaneTuning.STEP_SECONDS, orders);
            const events = copy.getEvents();
            for (let k = 0; k < events.getCount(); k++) {
                if (events.get(k).type === LightLaneEvents.STUMBLE) {
                    outcome.stumbles++;
                }
            }
            events.clear();
            if ((copy.getState() !== LightLaneSimulation.RUNNING) || (copy.getShieldDeaths() !== deaths)) {
                outcome.dead = true;
                outcome.time = ((i + 1) * LightLaneTuning.STEP_SECONDS);
                break;
            }
        }
        outcome.coins = (copy.getScore().getCoins() - coins);

        return outcome;
    }
}

// Run times are sums of steps: an order due at t + latency is due at that step, whatever the rounding.
LightLaneRobot.EPSILON = 1e-6;
// The orders it tries, doing nothing first (it wins a tie).
LightLaneRobot.ORDERS = Object.freeze([null, LightLaneCommandSampler.LEFT, LightLaneCommandSampler.RIGHT, LightLaneCommandSampler.JUMP, LightLaneCommandSampler.SLIDE]);
