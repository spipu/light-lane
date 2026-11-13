/**
 * Persistent settings, stored in the `setting` store of the lightlane IndexedDB base. The settings UI is built from
 * DEFINITIONS; the game reads the dedicated getters. Same keys and values as Spipu-Racing where the meaning is the
 * same.
 */
class LightLaneSettings extends AppSettings {
    static get DEFINITIONS() {
        return [
            {key: 'display.language',     nameCode: 'settings.display.language',    type: 'list', default: 'en', values: [{code: 'en', label: 'English'}, {code: 'fr', label: 'Français'}, {code: 'it', label: 'Italiano'}, {code: 'es', label: 'Español'}]},
            // Codes must match the keys of Object3dRendererList.
            {key: 'display.renderer',     nameCode: 'settings.display.renderer',    type: 'list', default: 'webgl', values: [{code: 'webgl', label: 'WebGL'}, {code: 'full', labelCode: 'value.renderer.softwareTextured'}, {code: 'flat', labelCode: 'value.renderer.softwareFlat'}, {code: 'fast', labelCode: 'value.renderer.softwareWireframe'}]},
            // The bloom of the WebGL renderer; without effect on the others.
            {key: 'display.bloom',        nameCode: 'settings.display.bloom',       type: 'bool', default: true},
            {key: 'display.show_fps',     nameCode: 'settings.display.showFps',     type: 'bool', default: false},
            {key: 'sound.volume_effects', nameCode: 'settings.sound.volumeEffects', type: 'list', default: '100', values: LightLaneSettings.VOLUME_VALUES},
            // The Controls page offers the devices available only; a device not available counts as the automatic choice.
            {key: 'controls.device',      nameCode: 'settings.controls.device',     type: 'list', default: LightLaneSettings.DEVICE_AUTO, values: [{code: LightLaneSettings.DEVICE_AUTO, labelCode: 'device.automatic'}, {code: LightLaneSettings.DEVICE_KEYBOARD, labelCode: 'device.keyboard'}, {code: LightLaneSettings.DEVICE_GAMEPAD, labelCode: 'device.gamepadAny'}, {code: LightLaneSettings.DEVICE_VIRTUAL_PAD, labelCode: 'device.virtualPad'}]},
            // One physical key per action (Escape stays the fixed pause key).
            {key: 'keyboard.left',        nameCode: 'settings.action.left',         type: 'char', default: 'ArrowLeft',  action: 'left'},
            {key: 'keyboard.right',       nameCode: 'settings.action.right',        type: 'char', default: 'ArrowRight', action: 'right'},
            {key: 'keyboard.jump',        nameCode: 'settings.action.jump',         type: 'char', default: 'ArrowUp',    action: 'jump'},
            {key: 'keyboard.slide',       nameCode: 'settings.action.slide',        type: 'char', default: 'ArrowDown',  action: 'slide'},
            // W3C standard gamepad layout: left stick = axes 0 and 1, cross = 0, circle = 1, start = 9.
            {key: 'pad.left_right',       nameCode: 'settings.action.leftRight',    type: 'padAxis',   default: '+0', action: 'leftRight', direction: 'right'},
            {key: 'pad.jump_slide',       nameCode: 'settings.action.jumpSlide',    type: 'padAxis',   default: '+1', action: 'jumpSlide', direction: 'up'},
            {key: 'pad.jump',             nameCode: 'settings.action.jump',         type: 'padButton', default: 0,    action: 'jump'},
            {key: 'pad.slide',            nameCode: 'settings.action.slide',        type: 'padButton', default: 1,    action: 'slide'},
            {key: 'pad.pause',            nameCode: 'settings.action.pause',        type: 'padButton', default: 9,    action: 'pause'}
        ];
    }

    constructor() {
        super(LightLaneSettings.DEFINITIONS, LightLaneDatabaseSchema.SETTING, LightLaneDatabaseSchema.SETTING_BY_KEY);
    }

    applyToTranslator(translator) {
        translator.setLanguage(this.getDisplayLanguage());

        return this;
    }

    getDisplayLanguage() {
        return this.get(LightLaneSettings.LANGUAGE_KEY);
    }

    getRenderer() {
        return this.get(LightLaneSettings.RENDERER_KEY);
    }

    isBloomOn() {
        return (this.get('display.bloom') === true);
    }

    isFpsShown() {
        return (this.get('display.show_fps') === true);
    }

    getEffectsVolume() {
        return this.getPercent('sound.volume_effects');
    }

    /**
     * @returns {string} LightLaneSettings.DEVICE_AUTO, DEVICE_KEYBOARD, DEVICE_GAMEPAD or DEVICE_VIRTUAL_PAD, as saved
     */
    getControlsDevice() {
        return this.get(LightLaneSettings.DEVICE_KEY);
    }
}

LightLaneSettings.DEVICE_AUTO        = 'auto';
LightLaneSettings.DEVICE_KEYBOARD    = 'keyboard';
LightLaneSettings.DEVICE_GAMEPAD     = 'gamepad';
LightLaneSettings.DEVICE_VIRTUAL_PAD = 'virtualGamepad';
LightLaneSettings.LANGUAGE_KEY       = 'display.language';
LightLaneSettings.RENDERER_KEY       = 'display.renderer';
LightLaneSettings.DEVICE_KEY         = 'controls.device';
LightLaneSettings.VOLUME_VALUES      = AppSettings.percentValues([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

const lightLaneSettings = new LightLaneSettings();
