/**
 * The run's HUD (art § 9), DOM in the 1920 × 1080 letterbox, sized in cqh (css/lightLane.css): top right the run's line
 * (time played mm:ss, coins, distance, score), under it the record's in the same columns (« – » for a time kept before
 * the time was; a value of the run past the record's lights up); centre the countdown (3, 2, 1, GO, each zoomed from 0.8 to 1.0 then
 * faded); top left the pause button of the HUD, clickable with the mouse, hidden while the touch controls show their
 * own at the same place;
 * bottom centre the frame rate when the setting asks for it. The DOM is written only when a shown value changes.
 *
 * Plan step 12 adds the bonus gauges (top left) and the double score's colour.
 */
class LightLaneHud extends AbstractHud {
    /**
     * @param {Engine3d}            engine
     * @param {LightLaneSimulation} simulation
     */
    constructor(engine, simulation) {
        super(engine);

        this._simulation = simulation;
        this._best       = null;
        this._onPause    = null;
        this._pauseShown = true;
        this._shield     = null;
        this._numbers    = new Intl.NumberFormat(appTranslator.getLocale());
        this._metres     = null;
        this._els        = {};
        this._lines      = {};
        this._ghosts     = {};
        this._shown      = LightLaneHud._emptyShown();
    }

    /**
     * @param {{score: int, distance: int, coins: int, time: int|null}|null} best - the record shown (the first of the 10 best scores),
     *        null without any (zeros shown)
     */
    setBest(best) {
        this._best = best;

        return this;
    }

    /**
     * @param {function()} callback - the HUD's pause button was clicked
     */
    setOnPause(callback) {
        this._onPause = callback;

        return this;
    }

    /**
     * @param {boolean} shown - the HUD's pause button shows (not while the touch controls show their own)
     */
    setPauseButtonShown(shown) {
        this._pauseShown = shown;

        return this;
    }

    /**
     * @param {function(): int|null} source - the test mode shield's death count, shown beside the frame rate; null: none
     */
    setShieldSource(source) {
        this._shield = source;

        return this;
    }

    init(container) {
        super.init(container);
        const root     = this._add(container, 'div', 'light-lane-hud');
        const els      = this._els;
        els.root       = root;
        // One grid for the run's line and the record's (user request): time, coins, distance, score in the same columns,
        // the record's label before them (the run's label cell empty).
        const stats    = this._add(root, 'div', 'light-lane-hud-stats');
        this._add(stats, 'span', 'light-lane-hud-run');
        this._valueCell('time', this._add(stats, 'span', 'light-lane-hud-stat light-lane-hud-run light-lane-hud-time'));
        this._icon(this._valueCell('coins', this._add(stats, 'span', 'light-lane-hud-stat light-lane-hud-run')), LightLaneHud.COIN_ICON);
        this._valueCell('distance', this._add(stats, 'span', 'light-lane-hud-stat light-lane-hud-run'));
        this._valueCell('score', this._add(stats, 'span', 'light-lane-hud-stat light-lane-hud-run light-lane-hud-score'));
        this._add(stats, 'span', 'light-lane-hud-rule');
        els.bestLabel  = this._add(stats, 'span', 'light-lane-hud-stat light-lane-hud-best light-lane-hud-best-label');
        this._valueCell('bestTime', this._add(stats, 'span', 'light-lane-hud-stat light-lane-hud-best'));
        this._icon(this._valueCell('bestCoins', this._add(stats, 'span', 'light-lane-hud-stat light-lane-hud-best')), LightLaneHud.COIN_ICON);
        this._valueCell('bestDistance', this._add(stats, 'span', 'light-lane-hud-stat light-lane-hud-best'));
        this._valueCell('best', this._add(stats, 'span', 'light-lane-hud-stat light-lane-hud-best light-lane-hud-score'));
        els.countdown  = this._add(root, 'div', 'light-lane-hud-countdown');
        els.pause      = this._add(root, 'button', 'light-lane-hud-pause');
        els.pause.type = 'button';
        els.pause.innerHTML = LightLaneHud.PAUSE_ICON;
        els.pause.addEventListener('click', () => {
            if (this._onPause !== null) {
                this._onPause();
            }
        });
        els.fps        = this._add(root, 'div', 'light-lane-hud-fps');
        this.refreshTexts();
    }

    // The language may change in the pause's options: the labels and the number format follow it.
    refreshTexts() {
        this._numbers = new Intl.NumberFormat(appTranslator.getLocale());
        this._metres  = new Intl.NumberFormat(appTranslator.getLocale(), {style: 'unit', unit: 'meter', unitDisplay: 'short', maximumFractionDigits: 0});
        this._shown   = LightLaneHud._emptyShown();
        if (this._els.root === undefined) {
            return this;
        }
        this._els.bestLabel.textContent = appTranslator.get('hud.best');
        // Each value's room: its largest value (RESERVED), in this language's format.
        for (const [name, sample] of Object.entries(LightLaneHud.RESERVED)) {
            this._writeChars(this._ghosts[name], this._format(name, sample));
        }
        this._els.pause.setAttribute('aria-label', appTranslator.get('pause.title'));

        return this;
    }

    update() {
        if (this._els.root === undefined) {
            return;
        }
        const score    = this._simulation.getScore();
        const distance = Math.floor(this._simulation.getDistance());
        const coins    = score.getCoins();
        const best     = (this._best ?? LightLaneHud.NO_RECORD);
        this._number('score', score.getScore());
        this._number('distance', distance);
        this._number('coins', coins);
        this._number('time', Math.floor(this._simulation.getRunTime()));
        this._number('best', best.score);
        this._number('bestDistance', best.distance);
        this._number('bestCoins', best.coins);
        this._number('bestTime', best.time);
        // The run's values past the record's light up (none without a record).
        const record = (this._best !== null);
        this._mark('score', (record && (score.getScore() > best.score)));
        this._mark('distance', (record && (distance > best.distance)));
        this._mark('coins', (record && (coins > best.coins)));
        this._display('pause', this._pauseShown);
        this._updateCountdown();
        this._updateFps();
    }

    /**
     * @param {number} seconds
     * @returns {string} mm:ss (minutes past 99 keep counting)
     */
    static formatTime(seconds) {
        const total   = Math.floor(seconds);
        const minutes = Math.floor(total / LightLaneHud.SECONDS_PER_MINUTE);
        const rest    = (total % LightLaneHud.SECONDS_PER_MINUTE);

        return (String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0'));
    }

    _updateCountdown() {
        const label = this._simulation.getCountdownLabel();
        this._display('countdown', (label !== null));
        if (label === null) {
            return;
        }
        this._text('countdown', ((label === LightLaneSimulation.GO) ? appTranslator.get('hud.go') : label));
        const phase   = this._simulation.getCountdownPhase();
        const zoom    = Math.min(1, (phase / LightLaneHud.ZOOM_SHARE));
        const scale   = (LightLaneHud.ZOOM_FROM + ((1 - LightLaneHud.ZOOM_FROM) * zoom));
        const opacity = ((phase < LightLaneHud.FADE_FROM) ? 1 : ((1 - phase) / (1 - LightLaneHud.FADE_FROM)));
        this._style('countdown', 'transform', 'translate(-50%, -50%) scale(' + scale.toFixed(3) + ')');
        this._style('countdown', 'opacity', opacity.toFixed(3));
    }

    _updateFps() {
        const visible = (lightLaneSettings.isFpsShown() || (this._shield !== null));
        this._display('fps', visible);
        if (visible) {
            const fps = appTranslator.get('hud.fps', {value: this._engine.getFps()});
            this._text('fps', ((this._shield !== null) ? (fps + LightLaneHud.SHIELD_SEPARATOR + this._shield()) : fps));
        }
    }

    // --- DOM, rewritten only on a change ---

    _add(parent, tag, className, text = null) {
        const el = document.createElement(tag);
        el.className = className;
        if (text !== null) {
            el.textContent = text;
        }
        parent.appendChild(el);

        return el;
    }

    _text(name, text) {
        if (this._shown.text[name] !== text) {
            this._shown.text[name] = text;
            this._els[name].textContent = text;
        }
    }

    // A shown number, formatted only when it changes (Intl.NumberFormat at every frame allocates its text).
    _number(name, value) {
        if (this._shown.value[name] === value) {
            return;
        }
        this._shown.value[name] = value;
        this._writeChars(this._lines[name], this._format(name, value));
    }

    // A value as its cell shows it: by its kind (VALUE_KINDS), a time as mm:ss (« – » when absent).
    _format(name, value) {
        switch (LightLaneHud.VALUE_KINDS[name]) {
            case LightLaneHud.KIND_METRES:
                return this._metres.format(value);
            case LightLaneHud.KIND_TIME:
                return ((value !== null) ? LightLaneHud.formatTime(value) : LightLaneHud.NO_TIME);
            default:
                return this._numbers.format(value);
        }
    }

    // An icon after a stat's value (user request: the coin's on the right of their number).
    _icon(stat, icon) {
        const symbol     = this._add(stat, 'span', 'light-lane-hud-icon');
        symbol.innerHTML = icon;
    }

    // A value's cell (user request: the columns never move): a hidden copy of its largest value (its room, written by
    // refreshTexts) under its value, both right-aligned in one grid cell.
    _valueCell(name, parent) {
        const cell         = this._add(parent, 'span', 'light-lane-hud-cell');
        this._ghosts[name] = this._add(cell, 'span', 'light-lane-hud-ghost');
        this._lines[name]  = this._add(cell, 'span', 'light-lane-hud-line');
        this._els[name]    = cell;

        return parent;
    }

    // `text` in `line`, a span a character: a digit in a box of one width (Oswald's figures have not), the others at
    // their own; the spans reused, those past the text hidden.
    _writeChars(line, text) {
        const spans = line.children;
        for (let i = 0; i < text.length; i++) {
            const span      = ((i < spans.length) ? spans[i] : this._add(line, 'span', ''));
            const character = text[i];
            const className = (((character >= '0') && (character <= '9')) ? LightLaneHud.DIGIT_CLASS : '');
            if (span.className !== className) {
                span.className = className;
            }
            if (span.textContent !== character) {
                span.textContent = character;
            }
            if (span.style.display !== '') {
                span.style.display = '';
            }
        }
        for (let i = text.length; i < spans.length; i++) {
            if (spans[i].style.display !== 'none') {
                spans[i].style.display = 'none';
            }
        }
    }

    _mark(name, beaten) {
        if (this._shown.beaten[name] !== beaten) {
            this._shown.beaten[name] = beaten;
            this._els[name].classList.toggle('light-lane-hud-beaten', beaten);
        }
    }

    _style(name, property, value) {
        const shown = (this._shown.style[name] ??= {});
        if (shown[property] !== value) {
            shown[property] = value;
            this._els[name].style[property] = value;
        }
    }

    // What is shown, by kind then by element (no key built a frame).
    static _emptyShown() {
        return {text: {}, value: {}, beaten: {}, style: {}, display: {}};
    }

    _display(name, visible) {
        if (this._shown.display[name] !== visible) {
            this._shown.display[name] = visible;
            this._els[name].style.display = ((visible) ? '' : 'none');
        }
    }
}

// Test mode: the frame rate, then the shield's death count (not translated: a debug line).
LightLaneHud.SHIELD_SEPARATOR = ' | shield deaths: ';
LightLaneHud.SECONDS_PER_MINUTE = 60;
// Without a record: zeros.
LightLaneHud.NO_RECORD = Object.freeze({score: 0, distance: 0, coins: 0, time: 0});
// A record kept before the time played was (as the best scores' table).
LightLaneHud.NO_TIME   = '–';
// How each value is written, and the room kept for it (user decisions: 99:59, 9 999 coins, 99 999 m, a score of 9 999).
LightLaneHud.KIND_NUMBER = 'number';
LightLaneHud.KIND_METRES = 'metres';
LightLaneHud.KIND_TIME   = 'time';
LightLaneHud.VALUE_KINDS = Object.freeze({
    time: LightLaneHud.KIND_TIME, coins: LightLaneHud.KIND_NUMBER, distance: LightLaneHud.KIND_METRES, score: LightLaneHud.KIND_NUMBER,
    bestTime: LightLaneHud.KIND_TIME, bestCoins: LightLaneHud.KIND_NUMBER, bestDistance: LightLaneHud.KIND_METRES, best: LightLaneHud.KIND_NUMBER
});
LightLaneHud.RESERVED_MINUTES  = 99;
LightLaneHud.RESERVED_SECONDS  = 59;
LightLaneHud.RESERVED_TIME     = ((LightLaneHud.RESERVED_MINUTES * LightLaneHud.SECONDS_PER_MINUTE) + LightLaneHud.RESERVED_SECONDS);
LightLaneHud.RESERVED_COINS    = 9999;
LightLaneHud.RESERVED_DISTANCE = 99999;
LightLaneHud.RESERVED_SCORE    = 9999;
LightLaneHud.RESERVED = Object.freeze({
    time: LightLaneHud.RESERVED_TIME, coins: LightLaneHud.RESERVED_COINS, distance: LightLaneHud.RESERVED_DISTANCE, score: LightLaneHud.RESERVED_SCORE,
    bestTime: LightLaneHud.RESERVED_TIME, bestCoins: LightLaneHud.RESERVED_COINS, bestDistance: LightLaneHud.RESERVED_DISTANCE, best: LightLaneHud.RESERVED_SCORE
});
// A digit's box (css/lightLane.css): one width for every figure.
LightLaneHud.DIGIT_CLASS = 'light-lane-hud-digit';
// A coin: the octahedron seen from the side, a diamond (art § 5.2).
LightLaneHud.COIN_ICON = '<svg viewBox="0 0 10 14" aria-hidden="true"><path d="M5 0 L10 7 L5 14 L0 7 Z"/></svg>';
// Countdown label: zoomed from ZOOM_FROM to 1 over the first ZOOM_SHARE of its time, faded out after FADE_FROM.
LightLaneHud.ZOOM_FROM  = 0.8;
LightLaneHud.ZOOM_SHARE = 0.5;
LightLaneHud.FADE_FROM  = 0.75;
// The pause bars of the touch controls' button (LightLaneControls.VIRTUAL_PAD_ICONS).
LightLaneHud.PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true">' + LightLaneControls.VIRTUAL_PAD_ICONS.pause.shapes + '</svg>';
