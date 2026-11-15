/**
 * Static suite: the bootstrap definition against the disk. Every file served from website/ is declared in
 * js/libBootstrap.json (the shell precached by the service worker aside), every declared file exists once, and every
 * class is declared after the class it extends (a file before those that use it at load time); no method or accessor
 * defined twice in a class (the second silently replaces the first). Every translation in the 4 languages, with the same placeholders.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const WEBSITE_DIR  = path.resolve(__dirname, '..', '..', 'website');
const DEFINITION   = 'js/libBootstrap.json';
const TRANSLATIONS = 'js/lightLane/lightLaneTranslations.js';
// The game's own sources (the engine and the socle are checked in 3d-engine).
const GAME_DIR     = 'js/lightLane/';
const LANGUAGES    = ['en', 'fr', 'it', 'es'];
// Served without a declaration: the shell precached by the service worker, the icons, the definition, the licences.
const UNDECLARED   = [
    /^index\.html$/, /^manifest\.webmanifest$/, /^appServiceWorker\.js$/, /^ping\.json$/, /^favicon\.ico$/,
    /^apple-touch-icon\.png$/, /^browserconfig\.xml$/, /^icon\//, /^css\/main\.css$/, /^js\/webapp\/appBootstrap\.js$/,
    /^js\/libBootstrap\.json$/, /\.md$/
];

class BootstrapBench {
    constructor() {
        this._failures = 0;
    }

    run() {
        const files    = Object.values(JSON.parse(this._read(DEFINITION)).files).flat().map((file) => file.replace(/^\//, ''));
        const declared = new Set(files);

        this._list('served but not declared', BootstrapBench._walk('').filter((file) => (!declared.has(file) && !UNDECLARED.some((pattern) => pattern.test(file)))));
        this._list('declared but missing', files.filter((file) => !fs.existsSync(path.join(WEBSITE_DIR, file))));
        this._list('declared twice', files.filter((file, index) => (files.indexOf(file) !== index)));
        this._list('classes declared before the class they extend', this._lateParents(files.filter((file) => file.endsWith('.js'))));
        this._list('methods defined twice in a class', this._twiceDefined(files.filter((file) => (file.endsWith('.js') && file.startsWith(GAME_DIR)))));
        this._list('translations missing a language or a placeholder', this._translationGaps());

        return this._failures;
    }

    // A method (static or not, an accessor too) defined twice at the class's level (4 spaces in) in one file — one class a
    // file in this project: the second silently replaces the first. Its signature may run over several lines.
    _twiceDefined(files) {
        const twice = [];
        for (const file of files) {
            const seen = new Set();
            for (const match of this._read(file).matchAll(/^    (static\s+)?(async\s+)?((?:get|set)\s+)?([A-Za-z_$][\w$]*)\s*\(/gm)) {
                const key = ((match[1] !== undefined) ? 'static ' : '') + ((match[3] !== undefined) ? match[3].trim() + ' ' : '') + match[4];
                if (seen.has(key)) {
                    twice.push(file + ': ' + key);
                }
                seen.add(key);
            }
        }

        return twice;
    }

    // Every code of the catalogue in each language, with the same {placeholders} in all of them.
    _translationGaps() {
        const ctx = vm.createContext({});
        vm.runInContext(this._read(TRANSLATIONS) + '\nthis.catalog = LightLaneTranslations.CATALOG;', ctx, {filename: TRANSLATIONS});
        const gaps = [];
        for (const [code, texts] of Object.entries(ctx.catalog)) {
            const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort().join(',');
            const missing      = LANGUAGES.filter((language) => (typeof texts[language] !== 'string') || (texts[language] === ''));
            if (missing.length > 0) {
                gaps.push(code + ': no ' + missing.join(', '));
                continue;
            }
            if (LANGUAGES.some((language) => (placeholders(texts[language]) !== placeholders(texts[LANGUAGES[0]])))) {
                gaps.push(code + ': placeholders differ');
            }
        }

        return gaps;
    }

    _lateParents(scripts) {
        const declaredIn = new Map();
        const late       = [];
        scripts.forEach((file, index) => {
            for (const match of this._read(file).matchAll(/^class (\w+)/gm)) {
                declaredIn.set(match[1], index);
            }
        });
        scripts.forEach((file, index) => {
            for (const match of this._read(file).matchAll(/^class \w+ extends (\w+)/gm)) {
                if ((declaredIn.get(match[1]) ?? -1) > index) {
                    late.push(file + ' extends ' + match[1] + ', declared after it');
                }
            }
        });

        return late;
    }

    _list(label, offenders) {
        const ok = (offenders.length === 0);
        if (!ok) {
            this._failures++;
        }
        console.log((ok ? '  ok   ' : '  FAIL ') + label + (ok ? ': none' : (':\n         ' + offenders.join('\n         '))));
    }

    _read(file) {
        return fs.readFileSync(path.join(WEBSITE_DIR, file), 'utf8');
    }

    static _walk(dir) {
        return fs.readdirSync(path.join(WEBSITE_DIR, dir), {withFileTypes: true})
            .flatMap((entry) => {
                const relative = ((dir === '') ? entry.name : (dir + '/' + entry.name));

                return (entry.isDirectory() ? BootstrapBench._walk(relative) : [relative]);
            })
            .sort();
    }
}

module.exports = {run: () => new BootstrapBench().run()};
