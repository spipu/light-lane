function loadApp() {
    new AppViewportStabilizer().install();

    // The saved language is applied once the settings are read (LightLaneMenuNavigator.start).
    appTranslator.addCatalog(AppMenuTranslations.CATALOG)
        .addCatalog(LightLaneTranslations.CATALOG)
        .setFallbackLanguage('en')
        .setLanguage('en');

    new LightLaneMenuNavigator().start();
}

appBootstrap.setReadyCallback(loadApp);
