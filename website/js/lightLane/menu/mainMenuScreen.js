/**
 * Main menu, the screen the application starts on: the logo over a simple menu, the help in the corner (as
 * Spipu-Racing).
 */
class MainMenuScreen extends AbstractLightLaneMenuScreen {
    /**
     * @param {LightLaneMenuNavigator} navigator
     * @param {AppMenuDisplay}         display
     */
    constructor(navigator, display) {
        super(navigator, display);

        this._mist       = null;
        this._mistTimer  = null;
        this._mistFrame  = 0;
        this._lightning  = null;
        this._flashTimer = null;
    }

    hide() {
        if (this._mistTimer !== null) {
            clearInterval(this._mistTimer);
            this._mistTimer = null;
        }
        if (this._flashTimer !== null) {
            clearTimeout(this._flashTimer);
            this._flashTimer = null;
        }
        this._mist      = null;
        this._lightning = null;
        MainMenuScreen._releaseMistFrames();

        return super.hide();
    }

    _build() {
        this._container.classList.add('app-menu-screen-home');
        this._addBackdrop();
        const {titleEl, listEl} = this._buildSimpleMenu('');
        this._addLogo(titleEl);

        this._addListItem(listEl, appTranslator.get('menu.play'), () => {
            this._navigator.startGame();
        });
        this._addListItem(listEl, appTranslator.get('menu.bestScores'), () => {
            this._navigator.openBestScores();
        });
        this._addGalleryItem(listEl);
        this._addListItem(listEl, appTranslator.get('menu.options'), () => {
            this._openModal(new LightLaneOptionsModal(this._display)).show();
        });
        this._addCornerButtons([{icon: 'help', label: appTranslator.get('menu.help'), action: () => {
            this._openModal(new LightLaneOptionsModal(this._display)).showHelp();
        }}]);

        this._nav.selectFirst();
    }

    // Greyed and out of the navigation until an item is unlocked (gameplay § 14).
    _addGalleryItem(listEl) {
        if (lightLaneGallery.hasAny()) {
            this._addListItem(listEl, appTranslator.get('menu.gallery'), () => this._navigator.openGallery());
            return;
        }
        AppMenuDom.addListItem(listEl, appTranslator.get('menu.gallery')).classList.add(MainMenuScreen.LOCKED_CLASS);
    }

    /**
     * The home's backdrop (art § 10.1, user requests: only on this screen, the city and the mist): the city under its
     * sky, lightning on its lights now and then, a floor of mist rolling towards it, a shade under the menu; laid out
     * in CSS (css/lightLane.css), whatever the 3D renderer, gone with the screen. The mist as the track's (user
     * request): the game's fog frames played at FOG_FPS on a grid of cells mirrored every other one across and along.
     */
    _addBackdrop() {
        const backdrop = AppMenuDom.addElement(this._container, 'div', 'app-menu-screen-background light-lane-home');
        this._container.insertBefore(backdrop, this._container.firstChild);
        for (const part of MainMenuScreen.BACKDROP_PARTS) {
            AppMenuDom.addElement(backdrop, 'div', 'light-lane-home-' + part);
        }
        this._lightning = backdrop.querySelector(MainMenuScreen.LIGHTNING_SELECTOR);
        const floor = AppMenuDom.addElement(backdrop, 'div', 'light-lane-home-floor');
        this._mist  = AppMenuDom.addElement(floor, 'div', 'light-lane-home-mist');
        const [columns, rows] = MainMenuScreen.MIST_CELLS;
        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                const cell = AppMenuDom.addElement(this._mist, 'div', 'light-lane-home-mist-cell');
                cell.classList.toggle(MainMenuScreen.MIRROR_ACROSS, ((column % 2) === 1));
                cell.classList.toggle(MainMenuScreen.MIRROR_ALONG, ((row % 2) === 1));
            }
        }
        AppMenuDom.addElement(backdrop, 'div', 'light-lane-home-shade');
        this._showMistFrame();
        if (window.matchMedia(MainMenuScreen.LESS_MOTION).matches) {
            return;
        }
        this._planFlash();
        // Played once every frame is decoded: a frame shown before its decoding paints nothing (the mist stayed black).
        MainMenuScreen._decodeMistFrames().then(() => {
            if ((this._mist !== null) && (this._mistTimer === null)) {
                this._mistTimer = setInterval(() => this._nextMistFrame(), (MainMenuScreen.MS_PER_SECOND / LightLaneTuning.FOG_FPS));
            }
        }).catch((error) => console.warn('MainMenuScreen - the mist frames could not be decoded', error));
    }

    /**
     * The fog frames loaded and decoded, kept while the home shows (≈ 31 MB decoded); a failure is tried again later.
     *
     * @returns {Promise}
     */
    static _decodeMistFrames() {
        if (MainMenuScreen._mistDecoded === null) {
            MainMenuScreen._mistImages  = [...Array(LightLaneTuning.FOG_FRAMES).keys()].map((frame) => {
                const image = new Image();
                image.src   = LightLaneModels.fogFrameUrl(frame);
                return image;
            });
            MainMenuScreen._mistDecoded = Promise.all(MainMenuScreen._mistImages.map((image) => image.decode())).catch((error) => {
                MainMenuScreen._releaseMistFrames();
                throw error;
            });
        }

        return MainMenuScreen._mistDecoded;
    }

    // Leaving the home: its decoded frames go (the run loads its own textures; they come back with the home).
    static _releaseMistFrames() {
        MainMenuScreen._mistImages  = null;
        MainMenuScreen._mistDecoded = null;
    }

    // The next lightning, FLASH_EVERY [min, max] seconds from now.
    _planFlash() {
        const [min, max] = MainMenuScreen.FLASH_EVERY;
        const seconds    = (min + (Math.random() * (max - min)));
        this._flashTimer = setTimeout(() => this._flash(), (seconds * MainMenuScreen.MS_PER_SECOND));
    }

    // A lightning of one or two strikes at random on the city's lights (not under a modal nor on a hidden page), then
    // the next one planned.
    _flash() {
        if (!document.hidden && (this._display.getContainer().querySelector(MainMenuScreen.MODAL_SELECTOR) === null)) {
            const strikes = MainMenuScreen.FLASH_STRIKES[Math.floor(Math.random() * MainMenuScreen.FLASH_STRIKES.length)];
            this._lightning.animate(strikes, {duration: MainMenuScreen.FLASH_DURATION, easing: 'ease-out'});
        }
        this._planFlash();
    }

    // The next frame, unless nothing would see it (a modal over the menu, the page hidden).
    _nextMistFrame() {
        if (document.hidden || (this._display.getContainer().querySelector(MainMenuScreen.MODAL_SELECTOR) !== null)) {
            return;
        }
        this._mistFrame = ((this._mistFrame + 1) % LightLaneTuning.FOG_FRAMES);
        this._showMistFrame();
    }

    // One custom property for every cell (their background reads it): one style write a frame.
    _showMistFrame() {
        this._mist.style.setProperty(MainMenuScreen.MIST_PROPERTY, MainMenuScreen.MIST_FRAMES[this._mistFrame]);
    }

    _addLogo(titleEl) {
        AppMenuDom.addText(titleEl, 'light-lane-logo-word', MainMenuScreen.LOGO_WORDS[0]);
        AppMenuDom.addText(titleEl, 'light-lane-logo-accent', MainMenuScreen.LOGO_WORDS[1]);
        AppMenuDom.addElement(titleEl, 'span', 'light-lane-logo-line');
    }
}

// The brand (LightLaneMenuNavigator.BRAND) cut where the logo changes colour; not translated.
MainMenuScreen.LOGO_WORDS = Object.freeze(['Light ', 'Lane']);
// An entry not available yet.
MainMenuScreen.LOCKED_CLASS = 'light-lane-menu-locked';
// The backdrop's layers, back to front (light-lane-home-* in css/lightLane.css): behind the floor, then on it.
MainMenuScreen.BACKDROP_PARTS = Object.freeze(['sky', 'sky light-lane-home-sky-bright']);
// The mist: [columns, rows] of cells (css/lightLane.css sizes and places them), mirrored by these classes, its frame in
// this custom property.
MainMenuScreen.MIST_CELLS     = Object.freeze([8, 4]);
MainMenuScreen.MIRROR_ACROSS  = 'light-lane-home-mirror-across';
MainMenuScreen.MIRROR_ALONG   = 'light-lane-home-mirror-along';
MainMenuScreen.MIST_PROPERTY  = '--light-lane-home-fog';
// Absolute: a relative url() in a custom property resolves against the style sheet that uses it (css/), not the page.
MainMenuScreen.MIST_FRAMES    = Object.freeze([...Array(LightLaneTuning.FOG_FRAMES).keys()].map((frame) => ('url("' + new URL(LightLaneModels.fogFrameUrl(frame), document.baseURI).href + '")')));
MainMenuScreen.MODAL_SELECTOR = '.app-menu-overlay';
MainMenuScreen.LESS_MOTION    = '(prefers-reduced-motion: reduce)';
MainMenuScreen.MS_PER_SECOND  = 1000;
// The fog frames decoded while the home shows (_decodeMistFrames, _releaseMistFrames).
MainMenuScreen._mistImages  = null;
MainMenuScreen._mistDecoded = null;
// The lightning (user requests): every FLASH_EVERY [min, max] seconds at random, FLASH_DURATION ms of the lights
// layer's opacity, one of FLASH_STRIKES at random: a strike then its fading, or a strike, a short dip, a second strike,
// its fading.
MainMenuScreen.LIGHTNING_SELECTOR = '.light-lane-home-sky-bright';
MainMenuScreen.FLASH_EVERY        = Object.freeze([3, 8]);
MainMenuScreen.FLASH_DURATION     = 900;
MainMenuScreen.FLASH_STRIKES      = Object.freeze([
    Object.freeze([
        Object.freeze({opacity: 0, offset: 0}),
        Object.freeze({opacity: 1, offset: 0.06}),
        Object.freeze({opacity: 0, offset: 1})
    ]),
    Object.freeze([
        Object.freeze({opacity: 0, offset: 0}),
        Object.freeze({opacity: 1, offset: 0.06}),
        Object.freeze({opacity: 0.25, offset: 0.16}),
        Object.freeze({opacity: 0.9, offset: 0.24}),
        Object.freeze({opacity: 0, offset: 1})
    ])
]);
