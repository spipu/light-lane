/**
 * The test mode (gameplay § 13), read once from the address: ?test=<options>, options separated by ",", each "name" or
 * "name:value" (seed, tier, track, script, speed, lod, pilot, shield). Active on the local host only (localhost, 127.0.0.1): on any
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
        this._speed  = null;   // a fixed speed, m/s, or null
        this._lod    = false;  // the tiles' levels of detail shown in colours
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

    /**
     * From the page's address. A bad parameter is told in the console and the game starts without the test mode (it
     * must not stop the application).
     */
    static fromLocation() {
        try {
            return new LightLaneTestMode(window.location.hostname, window.location.search).validate();
        } catch (error) {
            console.error(error.message);

            return new LightLaneTestMode(window.location.hostname, '');
        }
    }

    /**
     * Against what the game has today: a tier from 0 to TIER_LAST, written rows of known 3-lane patterns without enemies (the
     * 5 lanes and the enemies come with plan steps 10 and 11). The robot (`pilot`) does not exist yet: said once.
     *
     * @returns {LightLaneTestMode} this
     * @throws {Error} on an option the game cannot play
     */
    validate() {
        if ((this._tier !== null) && ((this._tier < 0) || (this._tier > LightLaneTuning.TIER_LAST))) {
            throw new Error('LightLaneTestMode - tier ' + this._tier + ' out of 0..' + LightLaneTuning.TIER_LAST);
        }
        for (const row of (this._track ?? [])) {
            const pattern = LightLanePatterns.get(row.id);
            if (pattern === undefined) {
                throw new Error('LightLaneTestMode - unknown pattern ' + row.id);
            }
            if ((row.offset !== 0) || (pattern.lanes.length !== 3) || pattern.lanes.some((code) => LightLanePatterns.ENEMIES.includes(code))) {
                throw new Error('LightLaneTestMode - pattern ' + row.id + ' needs the 5 lanes or the enemies (not there yet)');
            }
        }
        if (this._pilot) {
            console.warn('LightLaneTestMode - pilot: the robot is not there yet (plan step 11), the option does nothing');
        }

        return this;
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

    // The tiles' tops coloured by level of detail: red the fine cells, green the coarser ones, blue the plain tops.
    isLod() {
        return this._lod;
    }

    /**
     * @returns {number|null} a fixed speed, m/s (0: the track stands still, to look at it), or null
     */
    getSpeed() {
        return this._speed;
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
            case 'speed':
                this._speed = Number(value);
                if (!Number.isFinite(this._speed) || (this._speed < 0)) {
                    throw new Error('LightLaneTestMode - bad speed ' + value);
                }
                break;
            case 'lod':
                this._lod = true;
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
        const order = ((letter in LightLaneTestMode.ORDERS) ? LightLaneCommandSampler[LightLaneTestMode.ORDERS[letter]] : undefined);
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
// Script letters → the names of the orders' constants (LightLaneCommandSampler, read when a script is parsed).
LightLaneTestMode.ORDERS      = Object.freeze({L: 'LEFT', R: 'RIGHT', J: 'JUMP', S: 'SLIDE'});
