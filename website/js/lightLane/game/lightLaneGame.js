/**
 * The flow of a run (modelled on RacingGame, tech § 3.1): the files loaded, the scene shown, the frames, the
 * countdown, the pause menu over the frozen run (LightLanePauseModal: Escape, Start, the pause button of the HUD or of
 * the touch controls, a hidden page), restart and quit. The player's orders come from the controls through the
 * sampler (LightLaneCommandSampler); the simulation (LightLaneSimulation) never sees the engine; the presentation
 * (LightLanePresentation) reads it. Any error of the run stops it and brings the menus back with the error (_guard).
 *
 * The test mode (LightLaneTestMode, local host only) imposes the start tier and the scripted orders.
 */
class LightLaneGame {
    /**
     * @param {LightLaneMenuNavigator} navigator
     * @param {LightLaneTestMode}      testMode
     */
    constructor(navigator, testMode) {
        this._navigator       = navigator;
        this._testMode        = testMode;
        this._simulation      = new LightLaneSimulation();
        this._presentation    = new LightLanePresentation(this._simulation);
        this._controls        = null;
        this._sampler         = null;
        this._orders          = [];
        this._running         = false;
        this._paused          = false;
        this._pauseWasDown    = true;
        this._pauseDisplay    = null;
        this._pauseModal      = null;
        // The pause menu was at its root on the previous frame: an Escape that has just closed the options (the
        // socle closes them on keydown) must not also leave the pause.
        this._pauseAtRoot     = false;
        this._animateCallback = (timestamp) => this._guard(this._animate, timestamp);
        this._onVisibility    = () => this._guard(this._visibilityChanged);
    }

    async start() {
        const best = await lightLaneScores.list().then((scores) => ((scores.length > 0) ? scores[0].score : 0), () => 0);
        loader.reset();
        loader.beginBatch();
        this._presentation.build();
        loader.setCallback(() => {
            loader.clearCallback();
            this._guard(this._begin, best);
        });
        loader.endBatch();
    }

    // Leaving the run: the main menu.
    quit() {
        if (!this._running) {
            return;
        }
        this._teardown();
        this._navigator.endGame();
    }

    _begin(best) {
        this._presentation.show(best, () => this._guard(this._togglePause));
        this._controls = new LightLaneControls(this._presentation.getDisplay());
        this._sampler  = new LightLaneCommandSampler(this._controls, this._testMode.getScript());
        this._presentation.bindControls(this._controls);
        this._running  = true;
        document.addEventListener('visibilitychange', this._onVisibility);
        // Played with a gamepad, the screen gets no touch to keep it awake.
        new ScreenWakeLock().init();
        this._newRun();
        requestAnimationFrame(this._animateCallback);
    }

    _newRun() {
        this._simulation.newRun(this._testMode.getTier() ?? 0);
        this._presentation.newRun();
        this._sampler.restart();
        this._presentation.getEngine().resetDeltaClock();
    }

    // The scene, the pause menu, the listeners and the controls go: the menus come back.
    _teardown() {
        this._running = false;
        document.removeEventListener('visibilitychange', this._onVisibility);
        if (this._pauseModal !== null) {
            this._closePause();
        }
        this._presentation.teardown();
        if (this._controls !== null) {
            this._controls.teardown();
        }
        new ScreenWakeLock().release();
        loader.reset();
    }

    // --- Pause ---

    // From the root of the pause only, as it was on the previous frame: the stacked options handle Escape as one step
    // back.
    _togglePause() {
        if (!this._running) {
            return;
        }
        if (!this._paused) {
            this._enterPause();
            return;
        }
        if (this._pauseAtRoot) {
            this._leavePause();
        }
    }

    // The run stops under the menu: simulation, controls, touch controls.
    _enterPause() {
        this._paused       = true;
        this._pauseWasDown = true;
        this._pauseAtRoot  = false;
        this._controls.setVirtualPadVisible(false);
        this._pauseDisplay = new AppMenuDisplay('screen').init(true);
        // The theme blurs the run under the pause only: it no longer moves.
        this._pauseDisplay.getContainer().classList.add(LightLaneGame.FROZEN_DISPLAY_CLASS);
        this._pauseModal   = new LightLanePauseModal(this._pauseDisplay)
            .setOnResume(() => this._guard(this._leavePause))
            .setOnRestart(() => this._guard(this._restart))
            .setOnQuit(() => this.quit())
            .show();
    }

    // The settings changed in the pause apply on resume, a renderer change on the next free frame; then the countdown
    // of a resume (gameplay § 8.1).
    _leavePause() {
        this._closePause();
        this._paused       = false;
        this._pauseWasDown = true;
        this._presentation.getEngine().resetDeltaClock();
        this._controls.applySettings().setVirtualPadVisible(true);
        this._sampler.discard();
        this._simulation.resume();
    }

    _restart() {
        this._closePause();
        this._paused       = false;
        this._pauseWasDown = true;
        this._controls.applySettings().setVirtualPadVisible(true);
        this._newRun();
    }

    _closePause() {
        this._pauseModal.close();
        this._pauseDisplay.destroy();
        this._pauseModal   = null;
        this._pauseDisplay = null;
    }

    // A hidden page (another tab, the phone locked) pauses the run (tech § 3.1).
    _visibilityChanged() {
        if (this._running && !this._paused && (document.visibilityState === 'hidden')) {
            this._enterPause();
        }
    }

    // --- Frames ---

    _animate(timestamp) {
        if (!this._running) {
            return;
        }
        const engine = this._presentation.getEngine();
        engine.calculateDeltaTime(timestamp);
        const dt = (engine.getDeltaTime() / LightLaneTuning.MS_PER_SECOND);
        // Read on paused frames too, to keep the edge state: the pause button closes the menu from its root.
        const pauseDown = this._controls.readButtonPause();
        if (pauseDown && !this._pauseWasDown) {
            this._togglePause();
        }
        this._pauseWasDown = pauseDown;
        if (!this._running) {
            return;
        }
        this._pauseAtRoot = (this._paused && this._pauseModal.isAtRoot());
        this._presentation.getHud().setPauseButtonShown(this._controls.getDevice() !== LightLaneSettings.DEVICE_VIRTUAL_PAD);
        if (this._paused) {
            this._presentation.present(0, true, true);
            requestAnimationFrame(this._animateCallback);
            return;
        }
        const simulation = this._simulation;
        if (simulation.getState() === LightLaneSimulation.RUNNING) {
            this._sampler.sample(simulation.getRunTime(), this._orders);
        } else {
            this._sampler.discard();
            this._orders.length = 0;
        }
        const resuming = ((simulation.getState() === LightLaneSimulation.COUNTDOWN) && !simulation.isNewRun());
        simulation.advance(dt, this._orders);
        this._presentation.present(dt, resuming, false);

        requestAnimationFrame(this._animateCallback);
    }

    _guard(method, argument) {
        try {
            method.call(this, argument);
        } catch (error) {
            console.error(error);
            this._teardown();
            this._navigator.gameFailed(error);
        }
    }
}

LightLaneGame.FROZEN_DISPLAY_CLASS = 'light-lane-frozen';
