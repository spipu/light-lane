/**
 * The run's HUD (art § 9), DOM in the 1920 × 1080 letterbox, sized in cqh (css/lightLane.css): top right the score,
 * under it the run's line (distance, coins, time played mm:ss), then the record's (its score, distance, coins and time,
 * « – » for a record kept before the time was; a
 * value of the run past the record's lights up); centre the countdown (3, 2, 1, GO, each zoomed from 0.8 to 1.0 then
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
        const block    = this._add(root, 'div', 'light-lane-hud-score-block');
        els.score      = this._add(block, 'div', 'light-lane-hud-score');
        // One grid for the run's line and the record's: their distance, coins and time in the same columns (user
        // request); the run's first cell is empty (its score is the big one above).
        const stats    = this._add(block, 'div', 'light-lane-hud-stats');
        this._add(stats, 'span', 'light-lane-hud-run');
        els.distance   = this._add(stats, 'span', 'light-lane-hud-stat light-lane-hud-run');
        els.coins      = this._stat(stats, LightLaneHud.COIN_ICON, 'light-lane-hud-run');
        els.time       = this._add(stats, 'span', 'light-lane-hud-stat light-lane-hud-run light-lane-hud-time');
        this._add(stats, 'span', 'light-lane-hud-rule');
        const record   = this._add(stats, 'span', 'light-lane-hud-stat light-lane-hud-best');
        els.bestLabel  = this._add(record, 'span', 'light-lane-hud-best-label');
        els.best       = this._add(record, 'span', 'light-lane-hud-value');
        els.bestDistance = this._add(stats, 'span', 'light-lane-hud-stat light-lane-hud-best');
        els.bestCoins  = this._stat(stats, LightLaneHud.COIN_ICON, 'light-lane-hud-best');
        els.bestTime   = this._add(stats, 'span', 'light-lane-hud-stat light-lane-hud-best');
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
        this._number('score', score.getScore(), this._numbers);
        this._number('distance', distance, this._metres);
        this._number('coins', coins, this._numbers);
        this._number('time', Math.floor(this._simulation.getRunTime()), null);
        this._number('best', best.score, this._numbers);
        this._number('bestDistance', best.distance, this._metres);
        this._number('bestCoins', best.coins, this._numbers);
        this._number('bestTime', best.time, null);
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

    // A shown number, formatted only when it changes (Intl.NumberFormat at every frame allocates its text): by
    // `format`, or as mm:ss when it is null (a time: « – » when absent).
    _number(name, value, format) {
        if (this._shown.value[name] === value) {
            return;
        }
        this._shown.value[name] = value;
        if (format !== null) {
            this._text(name, format.format(value));
            return;
        }
        this._text(name, ((value !== null) ? LightLaneHud.formatTime(value) : LightLaneHud.NO_TIME));
    }

    // A stat: its icon, then its value (returned: the element whose text changes).
    _stat(parent, icon, line) {
        const stat      = this._add(parent, 'span', 'light-lane-hud-stat ' + line);
        const symbol    = this._add(stat, 'span', 'light-lane-hud-icon');
        symbol.innerHTML = icon;

        return this._add(stat, 'span', 'light-lane-hud-value');
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
// A coin: the octahedron seen from the side, a diamond (art § 5.2).
LightLaneHud.COIN_ICON = '<svg viewBox="0 0 10 14" aria-hidden="true"><path d="M5 0 L10 7 L5 14 L0 7 Z"/></svg>';
// Countdown label: zoomed from ZOOM_FROM to 1 over the first ZOOM_SHARE of its time, faded out after FADE_FROM.
LightLaneHud.ZOOM_FROM  = 0.8;
LightLaneHud.ZOOM_SHARE = 0.5;
LightLaneHud.FADE_FROM  = 0.75;
// The pause bars of the touch controls' button (LightLaneControls.VIRTUAL_PAD_ICONS).
LightLaneHud.PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true">' + LightLaneControls.VIRTUAL_PAD_ICONS.pause.shapes + '</svg>';
