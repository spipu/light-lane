/**
 * The lightlane database, version by version.
 *
 * Records:
 *  - setting: {id, key, value}
 *  - score: {id, score, coins, distance, time (seconds played; absent from the runs saved before it), date (ISO)} —
 *    the 10 best runs, nothing else of a run is kept
 *  - gallery (version 2): {item, date (ISO)} — an item of the gallery unlocked (gameplay § 14), keyed by the item
 */
class LightLaneDatabaseSchema {
    /**
     * @returns {AppDatabaseSchema}
     */
    static build() {
        return new AppDatabaseSchema(LightLaneDatabaseSchema.NAME)
            .addVersion(1, (upgrade) => {
                upgrade.createStore(LightLaneDatabaseSchema.SETTING, {indexes: [{name: LightLaneDatabaseSchema.SETTING_BY_KEY, keyPath: 'key', unique: true}]});
                upgrade.createStore(LightLaneDatabaseSchema.SCORE, {indexes: [{name: LightLaneDatabaseSchema.SCORE_BY_SCORE, keyPath: 'score', unique: false}]});
            })
            .addVersion(2, (upgrade) => {
                upgrade.createStore(LightLaneDatabaseSchema.GALLERY, {keyPath: LightLaneDatabaseSchema.GALLERY_KEY, autoIncrement: false});
            });
    }
}

LightLaneDatabaseSchema.NAME           = 'lightlane';
LightLaneDatabaseSchema.SETTING        = 'setting';
LightLaneDatabaseSchema.SETTING_BY_KEY = 'key';
LightLaneDatabaseSchema.SCORE          = 'score';
LightLaneDatabaseSchema.SCORE_BY_SCORE = 'score';
LightLaneDatabaseSchema.GALLERY        = 'gallery';
LightLaneDatabaseSchema.GALLERY_KEY    = 'item';
