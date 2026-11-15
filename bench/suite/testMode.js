/**
 * Test mode suite (gameplay § 13): LightLaneTestMode read in a vm, active on the local hosts only (the production host
 * and any other ignore the parameter), each option read as written.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const SOURCE = path.resolve(__dirname, '..', '..', 'website', 'js', 'lightLane', 'game', 'lightLaneTestMode.js');

class TestModeBench {
    constructor() {
        this._failures = 0;
        this._ctx      = vm.createContext({console: {warn: () => {}}, URLSearchParams, Number, Object, Error,
            LightLaneCommandSampler: {LEFT: 'left', RIGHT: 'right', JUMP: 'jump', SLIDE: 'slide'}});
        vm.runInContext(fs.readFileSync(SOURCE, 'utf8'), this._ctx, {filename: 'lightLaneTestMode.js'});
        this._TestMode = vm.runInContext('LightLaneTestMode', this._ctx);
    }

    run() {
        const search = '?test=seed:42,tier:3,track:S1|S3~|K4@1,script:3.0:S|1.2:J,pilot,shield';
        for (const host of ['localhost', '127.0.0.1']) {
            this._check(host + ': active', new this._TestMode(host, search).isActive());
        }
        for (const host of ['light-lane.spipu.net', '192.168.1.10', 'localhost.example.com']) {
            const mode = new this._TestMode(host, search);
            this._check(host + ': ignored', (!mode.isActive() && (mode.getSeed() === null) && (mode.getTier() === null) && !mode.isPilot() && !mode.isShield()));
        }
        this._check('localhost without the parameter: inactive', !new this._TestMode('localhost', '?other=1').isActive());

        const mode = new this._TestMode('localhost', search);
        this._check('seed', (mode.getSeed() === 42));
        this._check('tier', (mode.getTier() === 3));
        this._check('track: ids, mirror, offset', (JSON.stringify(mode.getTrack()) === JSON.stringify([
            {id: 'S1', mirror: false, offset: 0}, {id: 'S3', mirror: true, offset: 0}, {id: 'K4', mirror: false, offset: 1}
        ])));
        this._check('script: sorted by time', (JSON.stringify(mode.getScript()) === JSON.stringify([{time: 1.2, order: 'jump'}, {time: 3, order: 'slide'}])));
        this._check('pilot and shield', (mode.isPilot() && mode.isShield()));
        this._check('lod: the levels of detail in colours', new this._TestMode('localhost', '?test=lod').isLod());
        this._check('speed: a fixed speed, 0 allowed', (new this._TestMode('localhost', '?test=speed:0').getSpeed() === 0));
        let refused = false;
        try {
            new this._TestMode('localhost', '?test=script:1.0:X');
        } catch (error) {
            refused = true;
        }
        this._check('a bad script entry is refused', refused);
        // Empty or malformed values refused too (never read as 0), extra parts too.
        const bad = ['tier:', 'seed', 'speed', 'speed:-1', 'seed:1e3', 'seed:0x10', 'track:S1@', 'script::J', 'script:1:J:x', 'script:1:constructor'];
        const accepted = bad.filter((option) => {
            try {
                new this._TestMode('localhost', '?test=' + option);
                return true;
            } catch (error) {
                return false;
            }
        });
        this._check('empty or malformed values refused (' + bad.join(' ') + ')' + ((accepted.length > 0) ? (': accepted ' + accepted.join(' ')) : ''), (accepted.length === 0));
        this._check('speed: decimals accepted', (new this._TestMode('localhost', '?test=speed:12.5').getSpeed() === 12.5));

        return this._failures;
    }

    _check(label, ok) {
        if (!ok) {
            this._failures++;
        }
        console.log(((ok) ? '  ok   ' : '  FAIL ') + label);
    }
}

module.exports = {run: () => new TestModeBench().run()};
