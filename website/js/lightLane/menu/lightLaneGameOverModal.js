/**
 * The end of a run (art § 10, modelled on RacingResultsModal), over the frozen scene: the title, the score, "New
 * record!" for a first place or the rank among the 10 best, then the best score, the distance and the coins; Play again
 * (selected), Best scores, Quit. Play again also answers Enter, the gamepad's validate (the list's own) and the jump
 * order (the game's, through replay()). Every input is ignored for GAME_OVER_INPUT_LOCK after it opens, so a key still
 * pressed when the runner died does not skip it. No way back: the back inputs are inert.
 */
class LightLaneGameOverModal extends AppMenuAbstractListModal {
    /**
     * @param {AppMenuDisplay} display
     */
    constructor(display) {
        super(display);

        this._nav.setEscapeAsBack(false);
        this._onReplay = null;
        this._onScores = null;
        this._onQuit   = null;
        this._openedAt = 0;
    }

    setOnReplay(callback) {
        this._onReplay = callback;

        return this;
    }

    setOnScores(callback) {
        this._onScores = callback;

        return this;
    }

    setOnQuit(callback) {
        this._onQuit = callback;

        return this;
    }

    /**
     * @param {{score: int, coins: int, distance: int}} run
     * @param {int|null} rank - among the 10 best, null when out of them
     * @param {int}      best - the best score after this run
     */
    show(run, rank, best) {
        const numbers = new Intl.NumberFormat(appTranslator.getLocale());
        const metres  = new Intl.NumberFormat(appTranslator.getLocale(), {style: 'unit', unit: 'meter', maximumFractionDigits: 0});
        const {modal} = this._createShell(appTranslator.get('over.title'), 'app-menu-modal light-lane-over', 'app-menu-modal-message app-menu-modal-title');
        AppMenuDom.addText(modal, 'light-lane-over-score', numbers.format(run.score));
        const rankText = LightLaneGameOverModal.rankText(rank);
        if (rankText !== null) {
            AppMenuDom.addText(modal, ((rank === 1) ? 'light-lane-over-rank light-lane-over-record' : 'light-lane-over-rank'), rankText);
        }
        const table = AppMenuDom.addElement(modal, 'div', 'light-lane-over-table');
        this._addRow(table, appTranslator.get('over.best'), numbers.format(best));
        this._addRow(table, appTranslator.get('scores.distance'), metres.format(run.distance));
        this._addRow(table, appTranslator.get('scores.coins'), numbers.format(run.coins));

        const listEl = AppMenuDom.addElement(modal, 'div', 'app-menu-list app-menu-list-simple');
        this._nav.addItemIn(listEl, appTranslator.get('over.replay'), () => this.replay());
        this._nav.addItemIn(listEl, appTranslator.get('menu.bestScores'), () => this._unlocked(this._onScores));
        this._nav.addItemIn(listEl, appTranslator.get('pause.quit'), () => this._unlocked(this._onQuit));
        this._nav.attach();
        this._nav.selectFirst();
        this._openedAt = performance.now();

        return this;
    }

    // Play again, from any of its inputs, once the opening lock is over.
    replay() {
        this._unlocked(this._onReplay);
    }

    /**
     * @param {int|null} rank
     * @returns {string|null} "New record!", "2nd best score"..., null out of the 10 best
     */
    static rankText(rank) {
        switch (rank) {
            case null:
                return null;
            case 1:
                return appTranslator.get('over.record');
            case 2:
                return appTranslator.get('over.rank2');
            case 3:
                return appTranslator.get('over.rank3');
            default:
                return appTranslator.get('over.rank', {rank: rank});
        }
    }

    _unlocked(action) {
        if ((performance.now() - this._openedAt) < (LightLaneTuning.GAME_OVER_INPUT_LOCK * LightLaneTuning.MS_PER_SECOND)) {
            return;
        }
        action();
    }

    _addRow(table, label, value) {
        const row = AppMenuDom.addElement(table, 'div', 'light-lane-over-row');
        AppMenuDom.addText(row, 'light-lane-over-label', label);
        AppMenuDom.addText(row, 'light-lane-over-value', value);
    }

    _onBack() {
    }
}
