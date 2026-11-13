/**
 * The test mode (gameplay § 13), read once from the address: ?test=<options>, options separated by ",", each "name" or
 * "name:value" (seed, tier, track, script, pilot, shield). Active on the local host only (localhost, 127.0.0.1): on any
 * other host, the production included, the parameter is ignored without a word. Never offered by the interface; it lets
 * the runs be checked in the browser without playing: written rows, timed orders, the robot, no death.
 */
class LightLaneTestMode {
    /**
     * @param {string} hostname - location.hostname
     * @param {string} search   - location.search
     */
    constructor(hostname, search) {
        this._active = false;
        this._seed   = null;
        this._tier   = null;
        this._track  = null;   // [{id, mirror, offset}] or null
        this._script = null;   // [{time, order}] sorted, or null
        this._pilot  = false;
        this._shield = false;
        if (!LightLaneTestMode.LOCAL_HOSTS.includes(hostname)) {
            return;
        }
        const value = new URLSearchParams(search).get(LightLaneTestMode.PARAMETER);
        if (value === null) {
            return;
        }
        this._active = true;
        for (const option of value.split(',').filter((text) => (text !== ''))) {
            this._read(option);
        }
    }

    // From the page's address.
    static fromLocation() {
        return new LightLaneTestMode(window.location.hostname, window.location.search);
    }

    isActive() {
        return this._active;
    }

    /**
     * @returns {int|null} the imposed seed
     */
    getSeed() {
        return this._seed;
    }

    /**
     * @returns {int|null} the tier the run starts at
     */
    getTier() {
        return this._tier;
    }

    /**
     * @returns {{id: string, mirror: boolean, offset: int}[]|null} the imposed rows, in order
     */
    getTrack() {
        return this._track;
    }

    /**
     * @returns {{time: number, order: string}[]|null} timed orders (run time in s, LightLaneTestMode.ORDERS value)
     */
    getScript() {
        return this._script;
    }

    isPilot() {
        return this._pilot;
    }

    isShield() {
        return this._shield;
    }

    _read(option) {
        const colon = option.indexOf(':');
        const name  = ((colon < 0) ? option : option.slice(0, colon));
        const value = ((colon < 0) ? '' : option.slice(colon + 1));
        switch (name) {
            case 'seed':
                this._seed = LightLaneTestMode._integer(value, name);
                break;
            case 'tier':
                this._tier = LightLaneTestMode._integer(value, name);
                break;
            case 'track':
                this._track = value.split('|').filter((id) => (id !== '')).map((row) => LightLaneTestMode._row(row));
                break;
            case 'script':
                this._script = value.split('|').filter((entry) => (entry !== '')).map((entry) => LightLaneTestMode._order(entry))
                    .sort((a, b) => (a.time - b.time));
                break;
            case 'pilot':
                this._pilot = true;
                break;
            case 'shield':
                this._shield = true;
                break;
            default:
                console.warn('LightLaneTestMode - unknown option ' + name);
        }
    }

    // "<Id>", "<Id>~" (mirror), "<Id>@<offset>" (five lanes).
    static _row(text) {
        const at     = text.indexOf('@');
        const base   = ((at < 0) ? text : text.slice(0, at));
        const mirror = base.endsWith('~');

        return {
            id:     ((mirror) ? base.slice(0, -1) : base),
            mirror: mirror,
            offset: ((at < 0) ? 0 : LightLaneTestMode._integer(text.slice(at + 1), 'track offset'))
        };
    }

    // "<time>:<L|R|J|S>".
    static _order(text) {
        const [time, letter] = text.split(':');
        const order = LightLaneTestMode.ORDERS[letter];
        const at    = Number(time);
        if ((order === undefined) || !Number.isFinite(at)) {
            throw new Error('LightLaneTestMode - bad script entry ' + text);
        }

        return {time: at, order: order};
    }

    static _integer(text, name) {
        const value = Number(text);
        if (!Number.isInteger(value)) {
            throw new Error('LightLaneTestMode - bad ' + name + ' ' + text);
        }

        return value;
    }
}

LightLaneTestMode.PARAMETER   = 'test';
LightLaneTestMode.LOCAL_HOSTS = Object.freeze(['localhost', '127.0.0.1']);
// Script letters → orders (LightLaneCommandSampler).
LightLaneTestMode.ORDERS      = Object.freeze({L: 'left', R: 'right', J: 'jump', S: 'slide'});
