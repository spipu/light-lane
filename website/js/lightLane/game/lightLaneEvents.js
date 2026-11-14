/**
 * The one-shot events of the simulation since the presentation last read them (a jump, a lane change, a coin, a
 * death...): pooled records, emptied by the reader once played. No allocation once the pool is warm.
 */
class LightLaneEvents {
    constructor() {
        this._records = [];
        this._count   = 0;
    }

    /**
     * @param {string}               type   - LightLaneEvents constant
     * @param {number|string|null}   value  - what the type needs (a side, a death kind)
     * @param {LightLaneEntity|null} entity - the element involved
     */
    add(type, value = null, entity = null) {
        if (this._count === this._records.length) {
            this._records.push({type: null, value: null, entity: null});
        }
        const record  = this._records[this._count++];
        record.type   = type;
        record.value  = value;
        record.entity = entity;

        return this;
    }

    getCount() {
        return this._count;
    }

    /**
     * @param {int} index
     * @returns {{type: string, value: (number|string|null), entity: (LightLaneEntity|null)}} valid until clear()
     */
    get(index) {
        return this._records[index];
    }

    clear() {
        for (let i = 0; i < this._count; i++) {
            this._records[i].entity = null;
        }
        this._count = 0;

        return this;
    }
}

LightLaneEvents.LANE    = 'lane';      // value: -1 left, +1 right
LightLaneEvents.REFUSE  = 'refuse';
LightLaneEvents.JUMP    = 'jump';
LightLaneEvents.LAND    = 'land';
LightLaneEvents.SLIDE   = 'slide';
LightLaneEvents.STUMBLE = 'stumble';
LightLaneEvents.COIN    = 'coin';      // entity: the coin
LightLaneEvents.DEATH   = 'death';     // value: LightLaneRunner.DEATH_*
LightLaneEvents.START   = 'start';     // the countdown is over
LightLaneEvents.ANNOUNCE = 'announce';  // value: a Sentinel's attack (LightLaneSentinel type), or a stalker's kind (entity: the stalker)
LightLaneEvents.STRIKE   = 'strike';    // the Sentinel's column falls
