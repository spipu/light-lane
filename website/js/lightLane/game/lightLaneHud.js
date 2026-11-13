/**
 * The run's HUD (art § 9), DOM in the 1920 × 1080 letterbox, sized in cqh (css/lightLane.css): top centre the score,
 * the record under it; centre the countdown (3, 2, 1, GO, each zoomed from 0.8 to 1.0 then faded); top right the pause
 * button of the HUD, clickable with the mouse, hidden while the touch controls show their own at the same place;
 * bottom centre the frame rate when the setting asks for it. The DOM is written only when a shown value changes.
 *
 * Plan step 11 adds the bonus gauges (top left) and the double score's colour.
 */
class LightLaneHud extends AbstractHud {
    /**
     * @param {Engine3d}            engine
     * @param {LightLaneSimulation} simulation
     */
    constructor(engine, simulation) {
        super(engine);

        this._simulation = simulation;
        this._best       = 0;
        this._onPause    = null;
        this._pauseShown = true;
        this._shield     = null;
        this._numbers    = new Intl.NumberFormat(appTranslator.getLocale());
        this._els        = {};
        this._shown      = {};
    }

    /**
     * @param {int} best - the record shown (the first of the 10 best scores, 0 without any)
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
        const best     = this._add(block, 'div', 'light-lane-hud-best');
        this._add(best, 'span', 'light-lane-hud-best-label', appTranslator.get('hud.best'));
        els.best       = this._add(best, 'span', 'light-lane-hud-best-value');
        els.countdown  = this._add(root, 'div', 'light-lane-hud-countdown');
        els.pause      = this._add(root, 'button', 'light-lane-hud-pause');
        els.pause.type = 'button';
        els.pause.setAttribute('aria-label', appTranslator.get('pause.title'));
        els.pause.innerHTML = LightLaneHud.PAUSE_ICON;
        els.pause.addEventListener('click', () => {
            if (this._onPause !== null) {
                this._onPause();
            }
        });
        els.fps        = this._add(root, 'div', 'light-lane-hud-fps');
    }

    update() {
        if (this._els.root === undefined) {
            return;
        }
        this._text('score', this._numbers.format(this._simulation.getScore().getScore()));
        this._text('best', this._numbers.format(this._best));
        this._display('pause', this._pauseShown);
        this._updateCountdown();
        this._updateFps();
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
        if (this._shown[name + '.text'] !== text) {
            this._shown[name + '.text'] = text;
            this._els[name].textContent = text;
        }
    }

    _style(name, property, value) {
        const key = (name + '.' + property);
        if (this._shown[key] !== value) {
            this._shown[key] = value;
            this._els[name].style[property] = value;
        }
    }

    _display(name, visible) {
        if (this._shown[name + '.display'] !== visible) {
            this._shown[name + '.display'] = visible;
            this._els[name].style.display = ((visible) ? '' : 'none');
        }
    }
}

// Test mode: the frame rate, then the shield's death count (not translated: a debug line).
LightLaneHud.SHIELD_SEPARATOR = ' | shield deaths: ';
// Countdown label: zoomed from ZOOM_FROM to 1 over the first ZOOM_SHARE of its time, faded out after FADE_FROM.
LightLaneHud.ZOOM_FROM  = 0.8;
LightLaneHud.ZOOM_SHARE = 0.5;
LightLaneHud.FADE_FROM  = 0.75;
// The pause bars of the touch controls' button (LightLaneControls.VIRTUAL_PAD_ICONS).
LightLaneHud.PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true">' + LightLaneControls.VIRTUAL_PAD_ICONS.pause.shapes + '</svg>';
