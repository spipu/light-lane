/**
 * The lightlane database, version by version.
 *
 * Records:
 *  - setting: {id, key, value}
 *  - score: {id, score, coins, distance, date (ISO)} — the 10 best runs, nothing else of a run is kept
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
            });
    }
}

LightLaneDatabaseSchema.NAME           = 'lightlane';
LightLaneDatabaseSchema.SETTING        = 'setting';
LightLaneDatabaseSchema.SETTING_BY_KEY = 'key';
LightLaneDatabaseSchema.SCORE          = 'score';
LightLaneDatabaseSchema.SCORE_BY_SCORE = 'score';
