/**
 * The 10 best runs of this device: rank, score, coins, distance, date; the run just over is highlighted. The bottom
 * row holds Clear all (confirmed), then Back (as the best laps of Spipu-Racing).
 */
class BestScoresScreen extends AbstractLightLaneMenuScreen {
    constructor(navigator, display) {
        super(navigator, display);

        this._highlighted = null;
    }

    /**
     * @param {int|null} id - the score record to highlight, null for none
     */
    setHighlighted(id) {
        this._highlighted = id;

        return this;
    }

    _build() {
        const {panel, listEl} = this._buildPanel(appTranslator.get('menu.bestScores'));

        // Above the list: it stays in view while the list scrolls.
        const header = document.createElement('div');
        header.className = 'light-lane-scores-row light-lane-scores-header';
        panel.insertBefore(header, listEl);
        for (const code of BestScoresScreen.COLUMNS) {
            AppMenuDom.addText(header, 'light-lane-scores-cell', appTranslator.get(code));
        }

        const actions = this._addElement('div', 'app-menu-actions app-menu-actions-split', panel);
        const clear   = this._addButton(appTranslator.get('scores.clear'), () => this._confirmClear(), actions);
        const back    = this._addButton(appTranslator.get('menu.back'), () => this._onBack(), actions);
        clear.classList.add('app-menu-button-secondary');
        this._nav.setBottomButtons([clear, back], back);
        this._nav.selectFirst();

        this._fill(listEl);
    }

    _onBack() {
        this._navigator.showMainMenu();
    }

    _fill(listEl) {
        lightLaneScores.list().then((scores) => {
            if (scores.length === 0) {
                this._addListEmpty(listEl, appTranslator.get('scores.empty'));
                return;
            }
            const numbers = new Intl.NumberFormat(appTranslator.getLocale());
            const metres  = new Intl.NumberFormat(appTranslator.getLocale(), {style: 'unit', unit: 'meter', maximumFractionDigits: 0});
            const dates   = new Intl.DateTimeFormat(appTranslator.getLocale(), {dateStyle: 'short'});
            scores.forEach((record, i) => {
                const row = AppMenuDom.addElement(listEl, 'div', 'app-menu-item light-lane-scores-row');
                if (record.id === this._highlighted) {
                    row.classList.add('light-lane-scores-last');
                }
                AppMenuDom.addText(row, 'light-lane-scores-cell', String(i + 1));
                AppMenuDom.addText(row, 'light-lane-scores-cell light-lane-scores-score', numbers.format(record.score));
                AppMenuDom.addText(row, 'light-lane-scores-cell', numbers.format(record.coins));
                AppMenuDom.addText(row, 'light-lane-scores-cell', metres.format(record.distance));
                AppMenuDom.addText(row, 'light-lane-scores-cell', dates.format(new Date(record.date)));
            });
        }).catch((error) => this._failed(error));
    }

    _confirmClear() {
        new AppMenuModal(this._display).confirm(appTranslator.get('scores.clearConfirm'), () => {
            lightLaneScores.clear().then(() => this.show(), (error) => this._failed(error));
        }, null, null, true, appTranslator.get('scores.clearDetail'));
    }

    _failed(error) {
        new AppMenuModal(this._display).showError(appTranslator.get('scores.failed'), error.message);
    }
}

BestScoresScreen.COLUMNS = Object.freeze(['scores.rank', 'scores.score', 'scores.coins', 'scores.distance', 'scores.date']);
