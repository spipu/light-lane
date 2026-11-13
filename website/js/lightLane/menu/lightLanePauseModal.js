/**
 * Pause modal over the frozen run (modelled on RacingPauseModal): Resume, Restart (confirmed), Options, Quit
 * (confirmed: the run's score is lost, user decision; racing does not confirm). No bottom button: Backspace and the
 * gamepad back button resume; the Escape and pause toggle stays with the game, which leaves the pause from the root
 * only (isAtRoot): the stacked options modal handles Escape itself as one step back.
 */
class LightLanePauseModal extends AppMenuAbstractListModal {
    /**
     * @param {AppMenuDisplay} display
     */
    constructor(display) {
        super(display);

        this._nav.setEscapeAsBack(false);
        this._onResume  = null;
        this._onRestart = null;
        this._onQuit    = null;
        this._options   = null;
    }

    setOnResume(callback) {
        this._onResume = callback;

        return this;
    }

    setOnRestart(callback) {
        this._onRestart = callback;

        return this;
    }

    setOnQuit(callback) {
        this._onQuit = callback;

        return this;
    }

    show() {
        const {listEl} = this._openSimpleShell(appTranslator.get('pause.title'));
        this._nav.addItemIn(listEl, appTranslator.get('pause.resume'), () => this._onResume());
        this._nav.addItemIn(listEl, appTranslator.get('pause.restart'), () => this._confirmLoss('pause.restartConfirm', this._onRestart));
        this._nav.addItemIn(listEl, appTranslator.get('menu.options'), () => this._openOptions());
        this._nav.addItemIn(listEl, appTranslator.get('pause.quit'), () => this._confirmLoss('pause.quitConfirm', this._onQuit));
        this._nav.selectFirst();

        return this;
    }

    // The game's Escape toggle only leaves the pause from its root.
    isAtRoot() {
        return this._isTopOverlay();
    }

    _onBack() {
        this._onResume();
    }

    _teardown() {
        if (this._options !== null) {
            this._options.setOnClose(null).close();
            this._options = null;
        }
    }

    _confirmLoss(questionCode, action) {
        this._confirm(appTranslator.get(questionCode), action, null, null, true, appTranslator.get('pause.lostDetail'));
    }

    // Rebuilt when the options close: a language change must reach the title and the entries.
    _openOptions() {
        this._options = new LightLaneOptionsModal(this._display).setOnClose(() => {
            this._options = null;
            this.show();
        });
        this._options.show();
    }
}
