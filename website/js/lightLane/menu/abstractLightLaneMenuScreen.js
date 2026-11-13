/**
 * Base class of the Light Lane menu screens: the socle skeleton (AppMenuAbstractScreen) with the game's title.
 */
class AbstractLightLaneMenuScreen extends AppMenuAbstractScreen {
    /**
     * @param {LightLaneMenuNavigator} navigator
     * @param {AppMenuDisplay}         display
     */
    constructor(navigator, display) {
        super(display);

        this._navigator = navigator;
    }

    _titleText() {
        return LightLaneMenuNavigator.BRAND;
    }
}
