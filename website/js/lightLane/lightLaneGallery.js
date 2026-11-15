/**
 * The items of the gallery unlocked on this device (gameplay § 14), kept in the `gallery` store of the lightlane
 * database and mirrored in memory (read without waiting: the main menu's entry). Without storage (a private window),
 * those of the session are kept in memory only.
 */
class LightLaneGallery {
    constructor() {
        this._database = null;
        this._unlocked = new Set();
    }

    /**
     * @param {AppDatabase|null} database - the opened database holding the store, null without storage
     */
    init(database) {
        this._database = database;

        return this;
    }

    /**
     * @returns {Promise<void>} the items unlocked read from the store
     */
    async load() {
        this._unlocked.clear();
        if (this._database === null) {
            return;
        }
        for (const record of await this._database.getAll(LightLaneDatabaseSchema.GALLERY)) {
            this._unlocked.add(record.item);
        }
    }

    /**
     * @param {string} item - one of LightLaneTuning.GALLERY_ITEMS
     * @returns {boolean}
     */
    isUnlocked(item) {
        return this._unlocked.has(item);
    }

    /**
     * @returns {boolean} at least one item is unlocked
     */
    hasAny() {
        return (this._unlocked.size > 0);
    }

    /**
     * @param {int} mask - items passed, a bit each in the order of GALLERY_ITEMS (LightLaneSimulation.getPassed)
     * @returns {Promise<void>} those not unlocked yet are (at once in memory, then in the store)
     */
    async unlock(mask) {
        const date  = new Date().toISOString();
        const added = LightLaneTuning.GALLERY_ITEMS.filter((item, i) => (((mask & (1 << i)) !== 0) && !this._unlocked.has(item)));
        if (added.length === 0) {
            return;
        }
        added.forEach((item) => this._unlocked.add(item));
        if (this._database !== null) {
            await this._database.putMulti(added.map((item) => ({storeName: LightLaneDatabaseSchema.GALLERY, record: {item: item, date: date}})));
        }
    }

    async clear() {
        this._unlocked.clear();
        if (this._database !== null) {
            await this._database.clear(LightLaneDatabaseSchema.GALLERY);
        }
    }
}

const lightLaneGallery = new LightLaneGallery();
