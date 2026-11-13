/**
 * Main menu, the screen the application starts on: the logo over a simple menu, the help in the corner (as
 * Spipu-Racing).
 */
class MainMenuScreen extends AbstractLightLaneMenuScreen {
    _build() {
        this._container.classList.add('app-menu-screen-home');
        const {titleEl, listEl} = this._buildSimpleMenu('');
        this._addLogo(titleEl);

        this._addListItem(listEl, appTranslator.get('menu.bestScores'), () => {
            this._navigator.openBestScores();
        });
        this._addListItem(listEl, appTranslator.get('menu.options'), () => {
            this._openModal(new LightLaneOptionsModal(this._display)).show();
        });
        this._addCornerButtons([{icon: 'help', label: appTranslator.get('menu.help'), action: () => {
            this._openModal(new LightLaneOptionsModal(this._display)).showHelp();
        }}]);

        this._nav.selectFirst();
    }

    _addLogo(titleEl) {
        AppMenuDom.addText(titleEl, 'light-lane-logo-word', MainMenuScreen.LOGO_WORDS[0]);
        AppMenuDom.addText(titleEl, 'light-lane-logo-accent', MainMenuScreen.LOGO_WORDS[1]);
        AppMenuDom.addElement(titleEl, 'span', 'light-lane-logo-line');
    }
}

// The brand (LightLaneMenuNavigator.BRAND) cut where the logo changes colour; not translated.
MainMenuScreen.LOGO_WORDS = Object.freeze(['Light ', 'Lane']);
