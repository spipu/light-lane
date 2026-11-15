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

        this._mist        = null;
        this._mistContext = null;
        this._mistLoop    = null;
        this._mistClock   = 0;
        this._mistLast    = null;
        this._mistDrawn   = -1;
        this._mistSize    = [0, 0, 0];
        this._lightning   = null;
        this._flashTimer  = null;
    }

    hide() {
        if (this._mistLoop !== null) {
            cancelAnimationFrame(this._mistLoop);
            this._mistLoop = null;
        }
        if (this._flashTimer !== null) {
            clearTimeout(this._flashTimer);
            this._flashTimer = null;
        }
        this._mist        = null;
        this._mistContext = null;
        this._lightning   = null;
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
     * sky as it is, lightning on its lights now and then, a floor of mist rolling towards it, a shade under the menu;
     * laid out in CSS (css/lightLane.css), whatever the 3D renderer, gone with the screen. The mist as the track's
     * (user request): the game's fog frames played at MIST_FPS on cells mirrored every other one across and along,
     * drawn in a canvas (no CSS animation nor background changed at each frame: WebKit made them jump).
     */
    _addBackdrop() {
        const backdrop = AppMenuDom.addElement(this._container, 'div', 'app-menu-screen-background light-lane-home');
        this._container.insertBefore(backdrop, this._container.firstChild);
        for (const part of MainMenuScreen.BACKDROP_PARTS) {
            AppMenuDom.addElement(backdrop, 'div', 'light-lane-home-' + part);
        }
        this._lightning   = backdrop.querySelector(MainMenuScreen.LIGHTNING_SELECTOR);
        MainMenuScreen._addLightningFilter(backdrop);
        const floor       = AppMenuDom.addElement(backdrop, 'div', 'light-lane-home-floor');
        this._mist        = AppMenuDom.addElement(floor, 'canvas', 'light-lane-home-mist');
        this._mistContext = this._mist.getContext('2d');
        this._mistClock   = 0;
        this._mistLast    = null;
        this._mistDrawn   = -1;
        AppMenuDom.addElement(backdrop, 'div', 'light-lane-home-shade');
        const still = window.matchMedia(MainMenuScreen.LESS_MOTION).matches;
        if (!still) {
            this._planFlash();
        }
        const decoded = MainMenuScreen._decodeMistFrames();
        // The first frame as soon as it is decoded, the others played once all are: a frame not decoded paints nothing.
        MainMenuScreen._mistImages[0].decode().then(() => {
            if ((this._mist !== null) && (this._mistDrawn < 0)) {
                this._drawMist();
            }
        }).catch(() => null);
        decoded.then(() => {
            if ((this._mist !== null) && !still && (this._mistLoop === null)) {
                this._mistLoop = requestAnimationFrame((time) => this._animateMist(time));
            }
        }).catch((error) => console.warn('MainMenuScreen - the mist frames could not be decoded', error));
    }

    /**
     * The lightning's curve (user request), the filter of css/lightLane.css's lit city: each channel unchanged up to
     * LIGHTNING_KNEE, above it pushed towards white, x + (1 − x) × LIGHTNING_FORCE × t^LIGHTNING_POWER, t = (x − knee)
     * / (1 − knee); worked in sRGB (the picture's values, not linear light). Inline SVG: CSS only, no picture added.
     *
     * @param {HTMLElement} parent
     */
    static _addLightningFilter(parent) {
        const svg      = document.createElementNS(MainMenuScreen.SVG_NS, 'svg');
        const filter   = document.createElementNS(MainMenuScreen.SVG_NS, 'filter');
        const transfer = document.createElementNS(MainMenuScreen.SVG_NS, 'feComponentTransfer');
        const knee     = MainMenuScreen.LIGHTNING_KNEE;
        const steps    = MainMenuScreen.LIGHTNING_STEPS;
        const values   = [...Array(steps + 1).keys()].map((i) => {
            const x    = (i / steps);
            const rise = ((x > knee) ? Math.pow(((x - knee) / (1 - knee)), MainMenuScreen.LIGHTNING_POWER) : 0);
            return (x + ((1 - x) * MainMenuScreen.LIGHTNING_FORCE * rise)).toFixed(4);
        }).join(' ');
        svg.setAttribute('class', 'light-lane-home-filters');
        svg.setAttribute('aria-hidden', 'true');
        filter.setAttribute('id', MainMenuScreen.LIGHTNING_FILTER);
        filter.setAttribute('color-interpolation-filters', 'sRGB');
        for (const channel of MainMenuScreen.CHANNELS) {
            const curve = document.createElementNS(MainMenuScreen.SVG_NS, channel);
            curve.setAttribute('type', 'table');
            curve.setAttribute('tableValues', values);
            transfer.appendChild(curve);
        }
        filter.appendChild(transfer);
        svg.appendChild(filter);
        parent.appendChild(svg);
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

    // The mist's clock runs while the home is seen (not under a modal; the browser stops the frames of a hidden page),
    // a long gap counted MIST_STEP_MAX at most; the canvas is drawn again at each new fog frame (MIST_FPS).
    _animateMist(time) {
        this._mistLoop = requestAnimationFrame((next) => this._animateMist(next));
        const step     = ((this._mistLast !== null) ? Math.min((time - this._mistLast), MainMenuScreen.MIST_STEP_MAX) : 0);
        this._mistLast = time;
        if (this._display.getContainer().querySelector(MainMenuScreen.MODAL_SELECTOR) !== null) {
            return;
        }
        this._mistClock += step;
        if (Math.floor((this._mistClock * MainMenuScreen.MIST_FPS) / MainMenuScreen.MS_PER_SECOND) !== this._mistDrawn) {
            this._drawMist();
        }
    }

    // The mist at its clock: the fog frame of the moment on cells MIST_CELL em large, mirrored every other one across
    // and along (neighbours join without a seam, as on the track), the first column MIST_ORIGIN em left of the middle,
    // the rows rolling towards the viewer by a mirrored pair every MIST_ROLL seconds. Whole pixels: no seam.
    _drawMist() {
        const images = MainMenuScreen._mistImages;
        if ((images === null) || (this._mist === null)) {
            return;
        }
        this._fitMist();
        const tick                  = Math.floor((this._mistClock * MainMenuScreen.MIST_FPS) / MainMenuScreen.MS_PER_SECOND);
        const image                 = images[tick % LightLaneTuning.FOG_FRAMES];
        const [width, height, em]   = this._mistSize;
        const cellWidth             = Math.round(MainMenuScreen.MIST_CELL[0] * em);
        const cellHeight            = Math.round(MainMenuScreen.MIST_CELL[1] * em);
        const left                  = Math.round((width / 2) - (MainMenuScreen.MIST_ORIGIN * em));
        const pair                  = (2 * cellHeight);
        const roll                  = Math.round((((this._mistClock / MainMenuScreen.MS_PER_SECOND) / MainMenuScreen.MIST_ROLL) % 1) * pair);
        const context               = this._mistContext;
        this._mistDrawn             = tick;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, width, height);
        for (let column = Math.floor(-left / cellWidth); (left + (column * cellWidth)) < width; column++) {
            const x      = (left + (column * cellWidth));
            const across = ((((column % 2) + 2) % 2) === 1);
            for (let row = 0; ((roll - pair) + (row * cellHeight)) < height; row++) {
                const y     = ((roll - pair) + (row * cellHeight));
                const along = ((row % 2) === 1);
                context.setTransform(((across) ? -1 : 1), 0, 0, ((along) ? -1 : 1), ((across) ? (x + cellWidth) : x), ((along) ? (y + cellHeight) : y));
                context.drawImage(image, 0, 0, cellWidth, cellHeight);
            }
        }
        context.setTransform(1, 0, 0, 1, 0, 0);
    }

    // The canvas at MIST_SCALE of the floor's size in CSS pixels, stretched by the browser (the mist is soft: a quarter
    // of the pixels to draw, user decision), and the em in its pixels.
    _fitMist() {
        const width  = Math.max(1, Math.round(this._mist.clientWidth * MainMenuScreen.MIST_SCALE));
        const height = Math.max(1, Math.round(this._mist.clientHeight * MainMenuScreen.MIST_SCALE));
        if ((width === this._mistSize[0]) && (height === this._mistSize[1])) {
            return;
        }
        this._mist.width  = width;
        this._mist.height = height;
        this._mistSize[0] = width;
        this._mistSize[1] = height;
        this._mistSize[2] = (parseFloat(getComputedStyle(this._mist).fontSize) * MainMenuScreen.MIST_SCALE);
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
// The backdrop's layers behind the floor, back to front (light-lane-home-* in css/lightLane.css).
MainMenuScreen.BACKDROP_PARTS = Object.freeze(['sky', 'sky light-lane-home-sky-lit']);
// The mist: cells [width, height] em (the frames' 2:1), the first column MIST_ORIGIN em left of the middle (a cell's
// middle on the middle, user request), a mirrored pair of rows rolled every MIST_ROLL seconds, its frames played at
// MIST_FPS (the track's FOG_FPS: at half of it, it looked jerky, user request); its clock counts MIST_STEP_MAX ms at
// most between two frames.
MainMenuScreen.MIST_CELL      = Object.freeze([20, 10]);
MainMenuScreen.MIST_ORIGIN    = 70;
MainMenuScreen.MIST_ROLL      = 14;
// Its canvas's resolution, as a share of its size on screen (user decision: half, a quarter of the pixels).
MainMenuScreen.MIST_SCALE     = 0.5;
MainMenuScreen.MIST_FPS       = LightLaneTuning.FOG_FPS;
MainMenuScreen.MIST_STEP_MAX  = 100;
MainMenuScreen.MODAL_SELECTOR = '.app-menu-overlay';
MainMenuScreen.LESS_MOTION    = '(prefers-reduced-motion: reduce)';
MainMenuScreen.MS_PER_SECOND  = 1000;
// The fog frames decoded while the home shows (_decodeMistFrames, _releaseMistFrames).
MainMenuScreen._mistImages  = null;
MainMenuScreen._mistDecoded = null;
// The lightning (user requests): every FLASH_EVERY [min, max] seconds at random, FLASH_DURATION ms of the lights
// layer's opacity, one of FLASH_STRIKES at random: a strike then its fading, or a strike, a short dip, a second strike,
// its fading.
MainMenuScreen.LIGHTNING_SELECTOR = '.light-lane-home-sky-lit';
// The lightning's curve (_addLightningFilter): its SVG filter's id (css/lightLane.css), unchanged up to LIGHTNING_KNEE
// (35 %: at 70 %, then 50 %, the lightning could hardly be seen, user requests), LIGHTNING_FORCE of the way to white
// above it, along t^LIGHTNING_POWER (1, a straight line: the square, under 1 for t in [0, 1], rose too little; user
// decisions), sampled in LIGHTNING_STEPS steps.
MainMenuScreen.LIGHTNING_FILTER   = 'light-lane-home-lightning';
MainMenuScreen.LIGHTNING_KNEE     = 0.35;
MainMenuScreen.LIGHTNING_FORCE    = 1;
MainMenuScreen.LIGHTNING_POWER    = 1;
MainMenuScreen.LIGHTNING_STEPS    = 100;
MainMenuScreen.SVG_NS             = 'http://www.w3.org/2000/svg';
MainMenuScreen.CHANNELS           = Object.freeze(['feFuncR', 'feFuncG', 'feFuncB']);
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
