/**
 * The fairness check of a row (generation § 8): a grid of the 5 lanes by cells of CELL metres over a window (from the
 * previous row's front to the end of the new row), each cell free, to jump (hurdle), to slide (gate), a gap, blocked
 * (block) or void (no tile); the vertical constraint (§ 8.2: a jump too soon after another jump or a slide → blocked);
 * then, from every passable lane at the window's start, a breadth-first search of (lane, cell, has acted) states: on
 * along the lane, or across to a neighbour lane over c(L) cells once the reaction time c(R) is over (or right away
 * after a first move). The row is fair when every start reaches past its last cell. The search also counts, for each
 * lane, the starts that reach the end on it (the coins show the safest way, § 9). No allocation once built.
 */
class LightLaneOccupancy {
    constructor() {
        this._capacity = 0;
        this._cells    = null;      // Uint8Array: lane index × capacity + cell
        this._stamp    = null;      // Int32Array: the search's visited states, by stamp
        this._queue    = null;      // Int32Array: packed states
        this._stampNow = 0;
        this._count    = 0;
        this._z0       = 0;
        this._width    = 0;         // the search's cells across a lane
        this._reach    = new Int32Array(LightLaneOccupancy.LANES);
        this._reached  = new Uint8Array(LightLaneOccupancy.LANES);
        this._grow(LightLaneOccupancy.START_CAPACITY);
    }

    /**
     * A new window, every cell free.
     *
     * @param {number} z0    - its start (a multiple of CELL)
     * @param {number} z1    - its end
     * @returns {LightLaneOccupancy} this
     */
    begin(z0, z1) {
        const count = Math.max(1, Math.ceil((z1 - z0) / LightLaneTuning.CELL));
        if ((count + LightLaneOccupancy.SEARCH_MARGIN) > this._capacity) {
            this._grow(Math.max((2 * this._capacity), (count + LightLaneOccupancy.SEARCH_MARGIN)));
        }
        this._z0    = z0;
        this._count = count;
        this._cells.fill(LightLaneOccupancy.FREE);

        return this;
    }

    getCount() {
        return this._count;
    }

    /**
     * @param {number} z
     * @returns {int} the cell holding z (may lie outside the window)
     */
    cellOf(z) {
        return Math.floor(((z - this._z0) / LightLaneTuning.CELL) + LightLaneOccupancy.EPSILON);
    }

    /**
     * The cells of a lane over [zFrom, zTo) take a state, the strongest kept (FREE < SLIDE < JUMP < GAP < BLOCKED < VOID).
     *
     * @param {int}    lane  - −2 to +2
     * @param {number} zFrom
     * @param {number} zTo
     * @param {int}    state
     */
    mark(lane, zFrom, zTo, state) {
        const from = Math.max(0, this.cellOf(zFrom));
        const to   = Math.min(this._count, Math.ceil(((zTo - this._z0) / LightLaneTuning.CELL) - LightLaneOccupancy.EPSILON));
        const base = ((lane + LightLaneOccupancy.LANE_OFFSET) * this._capacity);
        for (let k = from; k < to; k++) {
            if (this._cells[base + k] < state) {
                this._cells[base + k] = state;
            }
        }
    }

    /**
     * @param {int} lane
     * @param {int} k
     * @returns {int} the state of a cell; outside the window: FREE
     */
    get(lane, k) {
        if ((k < 0) || (k >= this._count) || (lane < -LightLaneOccupancy.LANE_OFFSET) || (lane > LightLaneOccupancy.LANE_OFFSET)) {
            return (((k < 0) || (k >= this._count)) ? LightLaneOccupancy.FREE : LightLaneOccupancy.VOID);
        }

        return this._cells[((lane + LightLaneOccupancy.LANE_OFFSET) * this._capacity) + k];
    }

    /**
     * The vertical constraint (§ 8.2): on a lane, an element to jump or a gap starting less than c(jumpTime) cells after
     * the last cell of another one, or less than c(FAIR_GATE_SLIDE) after the last cell of a gate, becomes blocked.
     *
     * @param {number} speed    - m/s
     * @param {number} jumpTime - s: the longest jump that may be on
     */
    applyVertical(speed, jumpTime) {
        const afterJump  = LightLaneOccupancy.cells(jumpTime, speed);
        const afterSlide = LightLaneOccupancy.cells(LightLaneTuning.FAIR_GATE_SLIDE, speed);
        for (let i = 0; i < LightLaneOccupancy.LANES; i++) {
            const base    = (i * this._capacity);
            let jumpEnd   = -Infinity;
            let slideEnd  = -Infinity;
            let k         = 0;
            while (k < this._count) {
                const state = this._cells[base + k];
                let end     = k;
                while (((end + 1) < this._count) && (this._cells[base + end + 1] === state)) {
                    end++;
                }
                if ((state === LightLaneOccupancy.JUMP) || (state === LightLaneOccupancy.GAP)) {
                    if (((k - jumpEnd) < afterJump) || ((k - slideEnd) < afterSlide)) {
                        for (let j = k; j <= end; j++) {
                            this._cells[base + j] = LightLaneOccupancy.BLOCKED;
                        }
                    }
                    jumpEnd = end;
                } else if (state === LightLaneOccupancy.SLIDE) {
                    slideEnd = end;
                }
                k = (end + 1);
            }
        }
    }

    /**
     * The search (§ 8.2), from k0 to past kLast.
     *
     * @param {int}    k0    - the first cell (the previous row's front + 1)
     * @param {int}    kLast - the new row's last cell
     * @param {number} speed - m/s
     * @returns {boolean} every passable start lane reaches past kLast
     */
    isFair(k0, kLast, speed) {
        const reactCells = LightLaneOccupancy.cells(LightLaneTuning.FAIR_REACTION, speed);
        const laneCells  = LightLaneOccupancy.cells(LightLaneTuning.LANE_CHANGE_TIME, speed);
        this._reach.fill(0);
        let fair = true;
        for (let start = -LightLaneOccupancy.LANE_OFFSET; start <= LightLaneOccupancy.LANE_OFFSET; start++) {
            if (!LightLaneOccupancy.passable(this.get(start, k0))) {
                continue;
            }
            if (!this._search(start, k0, kLast, reactCells, laneCells)) {
                fair = false;
            }
        }

        return fair;
    }

    /**
     * @param {int} lane
     * @returns {int} how many start lanes of the last search reach past the row on that lane
     */
    getReach(lane) {
        return this._reach[lane + LightLaneOccupancy.LANE_OFFSET];
    }

    /**
     * @param {int}    lane
     * @param {number} zFrom
     * @param {number} zTo
     * @returns {boolean} no cell of the lane over [zFrom, zTo) is blocked, void or a gap (a coin may lie there, § 9)
     */
    isClear(lane, zFrom, zTo) {
        const from = this.cellOf(zFrom);
        const to   = Math.ceil(((zTo - this._z0) / LightLaneTuning.CELL) - LightLaneOccupancy.EPSILON);
        for (let k = from; k < to; k++) {
            const state = this.get(lane, k);
            if ((state === LightLaneOccupancy.BLOCKED) || (state === LightLaneOccupancy.VOID) || (state === LightLaneOccupancy.GAP)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param {number} time  - s
     * @param {number} speed - m/s
     * @returns {int} c(t) = ceil(t × v / CELL)
     */
    static cells(time, speed) {
        return Math.ceil(((time * speed) / LightLaneTuning.CELL) - LightLaneOccupancy.EPSILON);
    }

    /**
     * @param {int} state
     * @returns {boolean} a runner may be on it (jumping, sliding or running)
     */
    static passable(state) {
        return ((state !== LightLaneOccupancy.BLOCKED) && (state !== LightLaneOccupancy.VOID));
    }

    _search(start, k0, kLast, reactCells, laneCells) {
        const lanes  = LightLaneOccupancy.LANES;
        const width  = ((kLast - k0) + laneCells + 2);
        if (width > this._capacity) {
            throw new Error('LightLaneOccupancy - the search is wider than the grid');
        }
        const stamp  = ++this._stampNow;
        const queue  = this._queue;
        let head     = 0;
        let tail     = 0;
        let reached  = false;
        this._width  = width;
        this._reached.fill(0);
        queue[tail++] = this._pack(start, 0, 0);
        while (head < tail) {
            const packed = queue[head++];
            const acted  = (packed % 2);
            const rest   = ((packed - acted) / 2);
            const offset = (rest % width);
            const lane   = (((rest - offset) / width) - LightLaneOccupancy.LANE_OFFSET);
            const k      = (k0 + offset);
            const index  = ((((lane + LightLaneOccupancy.LANE_OFFSET) * width) + offset) * 2) + acted;
            if (this._stamp[index] === stamp) {
                continue;
            }
            this._stamp[index] = stamp;
            if (k > kLast) {
                reached = true;
                this._reached[lane + LightLaneOccupancy.LANE_OFFSET] = 1;
                continue;
            }
            if (LightLaneOccupancy.passable(this.get(lane, k + 1))) {
                queue[tail++] = this._pack(lane, (offset + 1), acted);
            }
            const kMin = ((acted === 1) ? k : (k0 + reactCells));
            if (k < kMin) {
                continue;
            }
            for (let side = -1; side <= 1; side += 2) {
                const w = (lane + side);
                if ((w < -LightLaneOccupancy.LANE_OFFSET) || (w > LightLaneOccupancy.LANE_OFFSET) || !this._acrossClear(lane, w, k, laneCells)) {
                    continue;
                }
                queue[tail++] = this._pack(w, Math.min((width - 1), (offset + laneCells)), 1);
            }
        }
        for (let i = 0; i < lanes; i++) {
            this._reach[i] += this._reached[i];
        }

        return reached;
    }

    // Every cell of both lanes from k to k + laneCells is passable.
    _acrossClear(lane, w, k, laneCells) {
        for (let j = k; j <= (k + laneCells); j++) {
            if (!LightLaneOccupancy.passable(this.get(lane, j)) || !LightLaneOccupancy.passable(this.get(w, j))) {
                return false;
            }
        }

        return true;
    }

    _pack(lane, offset, acted) {
        const width = this._width;

        return (((((lane + LightLaneOccupancy.LANE_OFFSET) * width) + offset) * 2) + acted);
    }

    _grow(capacity) {
        this._capacity = capacity;
        this._cells    = new Uint8Array(LightLaneOccupancy.LANES * capacity);
        this._stamp    = new Int32Array(LightLaneOccupancy.LANES * capacity * 2);
        this._queue    = new Int32Array(LightLaneOccupancy.LANES * capacity * 2 * LightLaneOccupancy.QUEUE_SPARE);
        this._stampNow = 0;
    }
}

LightLaneOccupancy.LANES          = 5;
LightLaneOccupancy.LANE_OFFSET    = 2;
LightLaneOccupancy.START_CAPACITY = 512;
// Cells kept past the window for the search (a lane change at the last cell: c(LANE_CHANGE_TIME) at the top speed).
LightLaneOccupancy.SEARCH_MARGIN  = 32;
// Each state enters the queue at most once a predecessor; a few predecessors a state at most.
LightLaneOccupancy.QUEUE_SPARE    = 3;
// Lengths are multiples of the cell: rounding noise is not a cell.
LightLaneOccupancy.EPSILON        = 1e-6;
// Cell states, the strongest last.
LightLaneOccupancy.FREE    = 0;
LightLaneOccupancy.SLIDE   = 1;
LightLaneOccupancy.JUMP    = 2;
LightLaneOccupancy.GAP     = 3;
LightLaneOccupancy.BLOCKED = 4;
LightLaneOccupancy.VOID    = 5;
