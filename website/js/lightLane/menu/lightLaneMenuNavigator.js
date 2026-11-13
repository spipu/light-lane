/**
 * Entry point of the menus: instantiates the display, opens the database, reads the settings (their language reaches
 * the translator before the first screen is built) and handles the navigation between the screens (modelled on
 * RacingMenuNavigator).
 */
class LightLaneMenuNavigator {
    constructor() {
        this._display          = new AppMenuDisplay('screen', AppMenuDisplay.LANDSCAPE);
        this._database         = new AppDatabase(LightLaneDatabaseSchema.build());
        this._mainMenuScreen   = new MainMenuScreen(this, this._display);
        this._bestScoresScreen = new BestScoresScreen(this, this._display);
        this._currentScreen    = null;
        // Read once: the test mode of the local host (gameplay § 13), inactive anywhere else.
        this._testMode         = LightLaneTestMode.fromLocation();
    }

    // A storage failure keeps the default settings and the scores of the session only: the menu still opens, with a
    // notice.
    start() {
        this._display.init();
        this._database.open()
            .then(() => lightLaneSettings.init(this._database))
            .then(() => lightLaneScores.init(this._database))
            .then(() => true, (error) => {
                console.warn('LightLaneMenuNavigator - storage unavailable: ' + error.message);
                lightLaneScores.init(null);
                return false;
            })
            .then((storageReady) => {
                lightLaneSettings.applyToTranslator(appTranslator);
                this.showMainMenu();
                if (!storageReady) {
                    new AppMenuModal(this._display).info(appTranslator.get('menu.storageUnavailable'));
                }
            })
            .catch((error) => {
                console.error(error);
            });

        return this;
    }

    // The run replaces the menus (modelled on RacingMenuNavigator.startRace).
    startGame() {
        this._switchTo(null);
        this._display.destroy();
        new LightLaneGame(this, this._testMode).start().catch((error) => {
            console.error(error);
            this.gameFailed(error);
        });
    }

    // The run quit: the main menu.
    endGame() {
        this._display.init();
        this.showMainMenu();
    }

    /**
     * @param {int|null} highlighted - the run just over, highlighted in the best scores
     */
    endGameToScores(highlighted) {
        this._display.init();
        this.openBestScores(highlighted);
    }

    /**
     * @param {Error} error - what stopped the run
     */
    gameFailed(error) {
        this._display.init();
        this.showMainMenu();
        new AppMenuModal(this._display).showError(appTranslator.get('game.failed'), error.message);
    }

    showMainMenu() {
        this._switchTo(this._mainMenuScreen);
    }

    /**
     * @param {int|null} highlighted - the id of the score to highlight (the run just over), null for none
     */
    openBestScores(highlighted = null) {
        this._bestScoresScreen.setHighlighted(highlighted);
        this._switchTo(this._bestScoresScreen);
    }

    _switchTo(screen) {
        if (this._currentScreen !== null) {
            this._currentScreen.hide();
        }
        this._currentScreen = screen;
        if (screen !== null) {
            screen.show();
        }
    }
}

// The brand, never translated.
LightLaneMenuNavigator.BRAND = 'Light Lane';
