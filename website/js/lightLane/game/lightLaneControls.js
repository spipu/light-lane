/**
 * Run controls from one device at a time, chosen as Spipu-Racing does (RacingControls): the device forced in the
 * settings while it is available, otherwise the first available of gamepad > touch controls > keyboard. The keyboard
 * is offered off touch-only devices, the touch controls on them, the gamepad once detected. The player's bindings
 * come from LightLaneSettings (keyboard.* / pad.*).
 *
 * The touch controls are the swipes (AppInputSwipe) and one pause button in the top right corner. Every reader gives
 * the state of the moment, never an edge: LightLaneCommandSampler derives the orders from the previous state.
 */
class LightLaneControls {
    /**
     * @param {HTMLElement} display - the game display, which receives the touch controls and the swipes
     */
    constructor(display) {
        this._keyboard       = new AppInputKeyboard();
        this._gamepad        = new AppInputGamepad();
        this._virtualGamepad = new AppInputVirtualGamepad(LightLaneControls.VIRTUAL_PAD_LAYOUT);
        this._swipe          = new AppInputSwipe(display);
        this._device         = null;
        this._padSuppressed  = false;
        this._onGamepad      = () => this._selectDevice();
        this._virtualGamepad.bindDisplay(display);
        this._swipe.attach();
        this.applySettings();
        window.addEventListener('gamepadconnected', this._onGamepad);
        window.addEventListener('gamepaddisconnected', this._onGamepad);
    }

    // The run is over: the gamepad events no longer choose its device, the swipes are no longer read.
    teardown() {
        window.removeEventListener('gamepadconnected', this._onGamepad);
        window.removeEventListener('gamepaddisconnected', this._onGamepad);
        this._swipe.detach();
        this._virtualGamepad.setVisible(false);
    }

    // The bindings and the device, read again after a change in the pause options.
    applySettings() {
        lightLaneSettings.applyBindings(this._keyboard, this._gamepad);
        this._device = null;
        this._selectDevice();

        return this;
    }

    /**
     * Rebuilds the touch controls into the display of a screen built again (a renderer changed in the pause).
     *
     * @param {HTMLElement} display
     */
    bindDisplay(display) {
        this._virtualGamepad.bindDisplay(display);

        return this;
    }

    /**
     * Hides (or restores) the touch controls while a menu covers the run. The suppression is remembered, so a device
     * change during the pause cannot bring them back over the menu.
     *
     * @param {boolean} visible
     */
    setVirtualPadVisible(visible) {
        this._padSuppressed = (visible !== true);
        this._applyVirtualPadVisibility();

        return this;
    }

    /**
     * @returns {string} the device in use: LightLaneSettings.DEVICE_KEYBOARD, DEVICE_GAMEPAD or DEVICE_VIRTUAL_PAD
     */
    getDevice() {
        return this._device;
    }

    readButtonLeft() {
        return (this._readAction('left') || this._dpad('readDpadLeft'));
    }

    readButtonRight() {
        return (this._readAction('right') || this._dpad('readDpadRight'));
    }

    readButtonJump() {
        return (this._readAction('jump') || this._dpad('readDpadUp'));
    }

    readButtonSlide() {
        return (this._readAction('slide') || this._dpad('readDpadDown'));
    }

    // Escape on the keyboard side, not remappable, read even with a pad active (as RacingControls).
    readButtonPause() {
        return (this._readAction('pause') || this._keyboard.readKey(LightLaneControls.PAUSE_KEY));
    }

    /**
     * @param {string} code - a KeyboardEvent.code
     * @returns {boolean} that key is held (the test mode's own keys)
     */
    readKey(code) {
        return this._keyboard.readKey(code);
    }

    /**
     * @returns {{x: number, y: number}} the gamepad stick written into out (x right +, y up +), 0 off the gamepad
     */
    readStick(out) {
        out.x = 0;
        out.y = 0;
        if (this._device === LightLaneSettings.DEVICE_GAMEPAD) {
            out.x = this._gamepad.readSlot('leftRight');
            out.y = this._gamepad.readSlot('jumpSlide');
        }

        return out;
    }

    /**
     * @returns {string|null} the oldest waiting swipe (AppInputSwipe.LEFT, RIGHT, UP, DOWN), or null
     */
    pollSwipe() {
        return this._swipe.poll();
    }

    // The waiting swipes are dropped (a menu opened, a countdown).
    clearSwipes() {
        this._swipe.clear();

        return this;
    }

    /**
     * @param {boolean} padOn - a gamepad is connected
     * @returns {string[]} the devices usable right now, in the order shown to the player
     */
    static availableDevices(padOn) {
        const touchOnly = LightLaneControls.isTouchOnlyDevice();

        return LightLaneControls.DEVICES.filter((device) => (
            ((device === LightLaneSettings.DEVICE_KEYBOARD) && !touchOnly)
            || ((device === LightLaneSettings.DEVICE_VIRTUAL_PAD) && touchOnly)
            || ((device === LightLaneSettings.DEVICE_GAMEPAD) && padOn)
        ));
    }

    /**
     * @param {boolean} padOn - a gamepad is connected
     * @returns {string} the saved device, the automatic choice when it is not available
     */
    static deviceChoice(padOn) {
        const saved = lightLaneSettings.getControlsDevice();

        return ((LightLaneControls.availableDevices(padOn).includes(saved)) ? saved : LightLaneSettings.DEVICE_AUTO);
    }

    /**
     * @param {boolean} padOn - a gamepad is connected
     * @returns {string} the device the player runs with
     */
    static deviceInUse(padOn) {
        const choice = LightLaneControls.deviceChoice(padOn);
        if (choice !== LightLaneSettings.DEVICE_AUTO) {
            return choice;
        }
        const available = LightLaneControls.availableDevices(padOn);

        return LightLaneControls.AUTO_PRIORITY.find((device) => available.includes(device));
    }

    // Primary pointer, not `any-pointer`: the latter reports possible capabilities (RacingControls).
    static isTouchOnlyDevice() {
        return (window.matchMedia('(pointer: coarse)').matches && (navigator.maxTouchPoints > 0));
    }

    _selectDevice() {
        const device = LightLaneControls.deviceInUse(this._gamepad.isAvailable());
        if (device === this._device) {
            return;
        }
        this._device = device;
        this._applyVirtualPadVisibility();
    }

    _applyVirtualPadVisibility() {
        this._virtualGamepad.setVisible(!this._padSuppressed && (this._device === LightLaneSettings.DEVICE_VIRTUAL_PAD));
    }

    _readAction(action) {
        if (this._device === LightLaneSettings.DEVICE_GAMEPAD) {
            return this._gamepad.readAction(action);
        }
        if (this._device === LightLaneSettings.DEVICE_VIRTUAL_PAD) {
            return this._virtualGamepad.readButton(action);
        }

        return this._keyboard.readAction(action);
    }

    // The cross of a gamepad on the standard mapping (AppInputGamepad.readDpad*).
    _dpad(reader) {
        return ((this._device === LightLaneSettings.DEVICE_GAMEPAD) && this._gamepad[reader]());
    }
}

LightLaneControls.PAUSE_KEY     = 'Escape';
// Order in which the devices are listed to the player.
LightLaneControls.DEVICES       = [LightLaneSettings.DEVICE_KEYBOARD, LightLaneSettings.DEVICE_GAMEPAD, LightLaneSettings.DEVICE_VIRTUAL_PAD];
LightLaneControls.AUTO_PRIORITY = [LightLaneSettings.DEVICE_GAMEPAD, LightLaneSettings.DEVICE_VIRTUAL_PAD, LightLaneSettings.DEVICE_KEYBOARD];

// --- Touch controls layout, in fractions of the letterboxed display ---

// Icon drawings in a 24×24 box: the pause bars.
LightLaneControls.VIRTUAL_PAD_ICONS = {
    pause: {shapes: '<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/>'}
};

// One button, in the top left corner (user request) at the HUD margin of 2.5 % of the height (x in widths: × 1080 /
// 1920).
LightLaneControls.VIRTUAL_PAD_BUTTONS = {
    pause: {x: 0.0141, y: 0.025, w: 0.079, h: 0.112, icon: 'pause'}
};

LightLaneControls.VIRTUAL_PAD_LAYOUT = {
    moveArea: null,
    aimArea:  null,
    buttons:  LightLaneControls.VIRTUAL_PAD_BUTTONS,
    icons:    LightLaneControls.VIRTUAL_PAD_ICONS
};
