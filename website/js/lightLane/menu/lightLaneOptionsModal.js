/**
 * Options modal (modelled on RacingOptionsModal): show() opens the tabs (display, sound, controls) with the reset
 * button, showHelp() the standalone help page. The Controls tab shows the device choice, then the settings of the
 * device in use; their key, button and axis captures are the socle's.
 */
class LightLaneOptionsModal extends AppMenuSettingsModal {
    /**
     * @param {AppMenuDisplay} display
     */
    constructor(display) {
        super(display, lightLaneSettings);

        this._gamepad      = new AppInputGamepad();
        this._shownDevices = null;
        this._onApply      = null;
    }

    /**
     * @param {function()|null} callback - called after a setting changed (the game applies the controls and sound)
     */
    setOnApply(callback) {
        this._onApply = callback;

        return this;
    }

    show() {
        return this._openTabs('menu.options', [
            this._settingsTab('options.display', 'display.'),
            this._settingsTab('options.sound', 'sound.'),
            {titleCode: 'options.controls', builder: () => this._buildControls()}
        ], {labelCode: 'options.reset', action: () => this._confirmReset()});
    }

    showHelp() {
        return this._open(true, 'menu.help', () => this._buildHelp());
    }

    _settingsTab(titleCode, prefix) {
        return {titleCode: titleCode, builder: () => this._buildSettingsList(lightLaneSettings.getDefinitions(prefix))};
    }

    // The device line, then the settings of the device in use; the page follows a gamepad plugged in or out.
    _buildControls() {
        const padOn  = this._gamepad.isAvailable();
        const list   = this._addList();
        const device = this._nav.addItemIn(list, appTranslator.get('settings.controls.device'), () => {
            this._stepDevice(1);
        }, (dir) => {
            this._stepDevice(dir);
        });
        AppMenuDom.addValue(device, this._deviceChoiceLabel(LightLaneControls.deviceChoice(padOn)), true);

        this._shownDevices = this._devicesState();
        const prefix = LightLaneOptionsModal.SETTING_PREFIXES[LightLaneControls.deviceInUse(padOn)];
        if (prefix !== null) {
            for (const definition of lightLaneSettings.getDefinitions(prefix)) {
                this._addSettingItem(list, definition);
            }
        }
        this._nav.selectFirst();

        this._setPageTimer(() => {
            if (this._devicesState() !== this._shownDevices) {
                this._renderPage();
            }
        }, LightLaneOptionsModal.DEVICE_REFRESH_MS);
    }

    _stepDevice(dir) {
        const padOn   = this._gamepad.isAvailable();
        const choices = [LightLaneSettings.DEVICE_AUTO, ...LightLaneControls.availableDevices(padOn)];
        const index   = choices.indexOf(LightLaneControls.deviceChoice(padOn));
        lightLaneSettings.set(LightLaneSettings.DEVICE_KEY, choices[((index + dir + choices.length) % choices.length)]);
        this._applySettings();
        this._renderPage();
    }

    _devicesState() {
        const padOn = this._gamepad.isAvailable();

        return [LightLaneControls.availableDevices(padOn).join(','), LightLaneControls.deviceInUse(padOn), (this._gamepad.getName() ?? '')].join('|');
    }

    _deviceChoiceLabel(choice) {
        if (choice === LightLaneSettings.DEVICE_AUTO) {
            return appTranslator.get('device.auto', {device: this._deviceLabel(LightLaneControls.deviceInUse(this._gamepad.isAvailable()))});
        }

        return this._deviceLabel(choice);
    }

    _deviceLabel(device) {
        if (device === LightLaneSettings.DEVICE_VIRTUAL_PAD) {
            return appTranslator.get('device.virtualPad');
        }
        if (device === LightLaneSettings.DEVICE_GAMEPAD) {
            return appTranslator.get('device.gamepad', {name: AppInputGamepad.displayName(this._gamepad.getName() ?? '')});
        }

        return appTranslator.get('device.keyboard');
    }

    _confirmReset() {
        this._confirm(appTranslator.get('options.resetConfirm'), () => {
            lightLaneSettings.resetAll();
            this._applySettings();
            this._renderPage();
        }, null, null, true, appTranslator.get('options.resetDetail'));
    }

    // How to play, then About.
    _buildHelp() {
        this._addHeading(appTranslator.get('help.play'));
        this._addLines(LightLaneOptionsModal.HELP_LINES);
        this._addHeading(appTranslator.get('help.about'));
        this._addLines(['help.about.what', 'help.about.author', 'help.about.font', 'help.about.mocap']);
        this._addLines(['help.about.copyright'], {year: new Date().getFullYear()});
    }

    // --- Settings hooks ---

    _applySettings() {
        lightLaneSettings.applyToTranslator(appTranslator);
        if (this._onApply !== null) {
            this._onApply();
        }
    }

    _rebuildsPage(definition) {
        return (definition.key === LightLaneSettings.LANGUAGE_KEY);
    }
}

LightLaneOptionsModal.DEVICE_REFRESH_MS = 500;
LightLaneOptionsModal.HELP_LINES        = Object.freeze(['help.goal', 'help.controls', 'help.colors', 'help.obstacles', 'help.hits', 'help.powerups', 'help.sentinel', 'help.score', 'help.pauseKey', 'help.performance']);
// Settings key prefix of each device; the touch controls have no setting of their own.
LightLaneOptionsModal.SETTING_PREFIXES  = Object.freeze({[LightLaneSettings.DEVICE_KEYBOARD]: 'keyboard.', [LightLaneSettings.DEVICE_GAMEPAD]: 'pad.', [LightLaneSettings.DEVICE_VIRTUAL_PAD]: null});
