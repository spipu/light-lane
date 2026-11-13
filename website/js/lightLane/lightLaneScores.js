/**
 * The 10 best runs of this device, kept in the `score` store of the lightlane database: score, coins, distance,
 * date. Without storage (a private window), the runs of the session are kept in memory only.
 */
class LightLaneScores {
    constructor() {
        this._database = null;
        this._memory   = [];
        this._memoryId = 0;
    }

    /**
     * @param {AppDatabase|null} database - the opened database holding the store, null without storage
     */
    init(database) {
        this._database = database;

        return this;
    }

    isStored() {
        return (this._database !== null);
    }

    /**
     * @returns {Promise<{id: int, score: int, coins: int, distance: int, date: string}[]>} best first, the oldest
     *          first between equal scores
     */
    async list() {
        const records = ((this._database !== null) ? await this._database.getAll(LightLaneDatabaseSchema.SCORE) : [...this._memory]);

        return records.sort(LightLaneScores._compare).slice(0, LightLaneScores.KEPT);
    }

    /**
     * @param {{score: int, coins: int, distance: int}} run
     * @returns {Promise<{rank: int, id: int}|null>} its rank among the 10 best (1 = record) and its record's id, null
     *          when it does not enter them
     */
    async add(run) {
        const record = {score: run.score, coins: run.coins, distance: run.distance, date: new Date().toISOString()};
        const best   = await this.list();
        if ((best.length >= LightLaneScores.KEPT) && (LightLaneScores._compare(record, best[best.length - 1]) >= 0)) {
            return null;
        }
        const rank = (best.filter((other) => (LightLaneScores._compare(other, record) <= 0)).length + 1);
        if (this._database === null) {
            const id     = ++this._memoryId;
            this._memory = [...best, {...record, id: id}].sort(LightLaneScores._compare).slice(0, LightLaneScores.KEPT);
            return {rank: rank, id: id};
        }
        const id      = await this._database.insert(LightLaneDatabaseSchema.SCORE, record);
        const ordered = (await this._database.getAll(LightLaneDatabaseSchema.SCORE)).sort(LightLaneScores._compare);
        const dropped = ordered.slice(LightLaneScores.KEPT).map((other) => ({storeName: LightLaneDatabaseSchema.SCORE, key: other.id}));
        if (dropped.length > 0) {
            await this._database.deleteMulti(dropped);
        }

        return {rank: rank, id: id};
    }

    async clear() {
        this._memory = [];
        if (this._database !== null) {
            await this._database.clear(LightLaneDatabaseSchema.SCORE);
        }
    }

    // Best score first; between equal scores the older run first (it was there before).
    static _compare(a, b) {
        if (a.score !== b.score) {
            return (b.score - a.score);
        }

        return ((a.date < b.date) ? -1 : ((a.date > b.date) ? 1 : 0));
    }
}

LightLaneScores.KEPT = 10;

const lightLaneScores = new LightLaneScores();
