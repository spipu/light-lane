/**
 * What the run shows (modelled on RacingPresentation): the screen and the engine on the renderer of the settings
 * (built again when the pause options change it: a canvas keeps one context type), the scene light and depth shading
 * of art § 2, the bloom when the setting asks for it (WebGL only), the camera (LightLaneCamera), the HUD
 * (LightLaneHud), the track's tiles from pools of instances, the runner and its clips. It reads the simulation, never
 * writes it.
 *
 * Plan step 7: a straight track of 3 lanes; the generated track replaces the pools' rows at step 9.
 */
class LightLanePresentation {
    /**
     * @param {LightLaneSimulation} simulation
     */
    constructor(simulation) {
        this._simulation   = simulation;
        this._screen       = null;
        this._engine       = null;
        this._hud          = null;
        this._camera       = new LightLaneCamera();
        this._controls     = null;
        this._rendererCode = null;
        this._best         = 0;
        this._onPause      = null;
        this._runner       = null;
        this._model        = null;
        this._clip         = null;
        this._rows         = [];      // pool slots: {row, tiles: Instance[], edge: Instance, far: boolean}
        this._horizon      = null;
        this._farDistance  = Infinity;
        this._ids          = null;
        this._events       = [];      // the runner's clip events of a frame (footsteps: the sound, step 13)
        this._bloom        = {};      // the bloom's parameters: RendererWebglBloom.DEFAULTS
    }

    // Inside the loader batch.
    build() {
        LightLaneModels.load();

        return this;
    }

    /**
     * The scene loaded: the screen, the engine, the HUD, the instances.
     *
     * @param {int}        best    - the record shown on the HUD
     * @param {function()} onPause - the HUD's pause button
     */
    show(best, onPause) {
        this._best    = best;
        this._onPause = onPause;
        this._ids     = {
            tile:        LightLaneModels.objectId(LightLaneModels.TILE),
            tileFar:     LightLaneModels.objectId(LightLaneModels.TILE + LightLaneModels.FAR_SUFFIX),
            tileEdge:    LightLaneModels.objectId(LightLaneModels.TILE_EDGE),
            tileEdgeFar: LightLaneModels.objectId(LightLaneModels.TILE_EDGE + LightLaneModels.FAR_SUFFIX),
        };
        this._model   = loader.animatedModels().getByCode(LightLaneModels.RUNNER);
        this._runner  = new AnimatedInstance(this._model).bind();
        const slots   = (Math.ceil((LightLaneTuning.TRACK_BEHIND + LightLaneTuning.TRACK_AHEAD) / LightLaneTuning.TILE_LENGTH) + 1);
        this._rows    = Array.from({length: slots}, () => ({
            row:   null,
            tiles: LightLaneTuning.LANES_3.map(() => LightLanePresentation._instance(this._ids.tile)),
            edge:  LightLanePresentation._instance(this._ids.tileEdge),
            far:   false
        }));
        this._horizon = LightLanePresentation._instance(LightLaneModels.objectId(LightLaneModels.HORIZON));
        this._buildDisplay();

        return this;
    }

    /**
     * @param {LightLaneControls} controls - the touch controls laid on the display
     */
    bindControls(controls) {
        this._controls = controls;

        return this;
    }

    getEngine() {
        return this._engine;
    }

    getHud() {
        return this._hud;
    }

    /**
     * @returns {HTMLElement} the display the touch controls and the swipes are laid on
     */
    getDisplay() {
        return this._screen.getDisplay();
    }

    // A new run: the camera onto the runner, the idle clip.
    newRun() {
        const simulation = this._simulation;
        this._camera.snap(simulation.getX(), simulation.getY(), simulation.getZ());
        this._clip = null;
        this._playClip(LightLanePresentation.CLIP_IDLE, 0);
        this._events.length = 0;
        this._runner.update(0, this._events);

        return this;
    }

    /**
     * The screen, the engine and the HUD built again when the renderer setting changed (in the pause options): on the
     * first frame no menu covers.
     *
     * @param {boolean} menuOpen
     */
    applyRendererSetting(menuOpen) {
        if (menuOpen || (lightLaneSettings.getRenderer() === this._rendererCode)) {
            return;
        }
        this._screen.destroyContainer();
        this._buildDisplay();
        this._controls.bindDisplay(this._screen.getDisplay());
    }

    /**
     * A frame: the runner's clip and pose, the camera, the scene drawn, the HUD.
     *
     * @param {number}  dt      - s
     * @param {boolean} frozen  - nothing moves (the pause, the countdown of a resume)
     * @param {boolean} menuOpen
     */
    present(dt, frozen, menuOpen) {
        this.applyRendererSetting(menuOpen);
        const simulation = this._simulation;
        if (!frozen) {
            this._animateRunner(dt);
            this._camera.follow(dt, simulation.getX(), simulation.getY(), simulation.getZ(), 0);
        }
        this._engine.setBloom((lightLaneSettings.isBloomOn() && (this._rendererCode === LightLanePresentation.BLOOM_RENDERER)) ? this._bloom : null);
        this._draw();
        this._screen.update();
    }

    teardown() {
        if (this._screen !== null) {
            this._screen.destroyContainer();
            this._screen = null;
        }
    }

    _animateRunner(dt) {
        const simulation = this._simulation;
        if (simulation.getState() === LightLaneSimulation.RUNNING) {
            const pace = Math.min((LightLaneTuning.RUN_PACE_BASE + (((simulation.getSpeed() - LightLaneTuning.RUN_PACE_FROM) / LightLaneTuning.RUN_PACE_SPAN) * LightLaneTuning.RUN_PACE_GAIN)), LightLaneTuning.RUN_PACE_MAX);
            this._playClip(LightLanePresentation.CLIP_RUN, LightLaneTuning.FADE_SHORT_CLIP);
            this._runner.getPlayer().setSpeed(pace);
        }
        this._runner.place([simulation.getX(), simulation.getY(), simulation.getZ()], LightLanePresentation.FACING);
        this._events.length = 0;
        this._runner.update(dt, this._events);
    }

    _playClip(name, fade) {
        if (this._clip === name) {
            return;
        }
        this._clip = name;
        const clip = this._model.getClip(name);
        if (fade > 0) {
            this._runner.getPlayer().crossFadeTo(clip, fade, {loop: true});
            return;
        }
        this._runner.getPlayer().play(clip, {loop: true});
    }

    _draw() {
        const engine = this._engine;
        engine.drawInit();
        this._camera.setView(engine);
        engine.lightsCalculatePosition();
        this._drawTrack();
        engine.drawInstance(this._runner.getInstance());
        engine.drawFinish();
    }

    // Each pool slot holds one row of tiles (row = floor(z / TILE_LENGTH)), placed when its row changes; the far
    // variant past the distance where a line would be under LINE_FAR_PIXELS (art § 4).
    _drawTrack() {
        const engine = this._engine;
        const z      = this._simulation.getZ();
        const length = LightLaneTuning.TILE_LENGTH;
        const first  = Math.floor((z - LightLaneTuning.TRACK_BEHIND) / length);
        const last   = Math.floor((z + LightLaneTuning.TRACK_AHEAD) / length);
        const camZ   = (z - LightLaneTuning.CAMERA_BACK);
        const y      = -LightLaneTuning.TILE_THICKNESS;
        for (let row = first; row <= last; row++) {
            const slot   = this._rows[((row % this._rows.length) + this._rows.length) % this._rows.length];
            const centre = ((row * length) + (length / 2));
            if (slot.row !== row) {
                slot.row = row;
                LightLaneTuning.LANES_3.forEach((lane, i) => slot.tiles[i].placeAt((lane * LightLaneTuning.LANE_WIDTH), y, centre));
                slot.edge.placeAt((LightLaneTuning.LANES_3[LightLaneTuning.LANES_3.length - 1] * LightLaneTuning.LANE_WIDTH), y, centre);
            }
            const distance = Math.abs(centre - camZ);
            const far      = ((slot.far) ? (distance > (LightLaneTuning.LINE_NEAR_RATIO * this._farDistance)) : (distance > this._farDistance));
            if (far !== slot.far) {
                slot.far = far;
                slot.tiles.forEach((tile) => tile.setObject((far) ? this._ids.tileFar : this._ids.tile));
                slot.edge.setObject((far) ? this._ids.tileEdgeFar : this._ids.tileEdge);
            }
            for (const tile of slot.tiles) {
                engine.drawInstance(tile);
            }
            engine.drawInstance(slot.edge);
        }
        this._horizon.placeAt(0, LightLaneTuning.HORIZON_Y, (z + LightLaneTuning.HORIZON_AHEAD));
        engine.drawInstance(this._horizon);
    }

    // The screen, the engine on the renderer of the settings, the HUD; the far-variant distance of the canvas.
    _buildDisplay() {
        this._rendererCode = lightLaneSettings.getRenderer();
        this._screen       = new ScreenManager('screen', {fullscreen: true, virtualWidth: LightLanePresentation.VIRTUAL_WIDTH, virtualHeight: LightLanePresentation.VIRTUAL_HEIGHT});
        this._engine       = new Engine3d(this._screen, new Object3dRendererList().getRenderer(this._rendererCode));
        this._engine.setFov(LightLaneTuning.CAMERA_FOV)
            .setZBuffer(LightLaneTuning.Z_NEAR, LightLaneTuning.Z_FAR)
            .setBackground(...LightLaneTuning.BACKGROUND)
            .setLightAmbient([...LightLaneTuning.AMBIENT])
            .setDepthShading({...LightLaneTuning.DEPTH_SHADING});
        this._hud = new LightLaneHud(this._engine, this._simulation).setBest(this._best).setOnPause(this._onPause);
        this._screen.bindHud(this._hud);
        const focal       = (LightLanePresentation.VIRTUAL_WIDTH / (2 * Math.tan(LightLaneTuning.CAMERA_FOV * Math.PI / LightLanePresentation.HALF_TURN)));
        this._farDistance = ((focal * LightLaneTuning.LINE_SIZE_DECOR) / LightLaneTuning.LINE_FAR_PIXELS);
        this._rows.forEach((slot) => {
            slot.row = null;
        });
    }

    static _instance(objectId) {
        const id = loader.instances().loadFromData(null, {object: objectId, position: [0, 0, 0], rotation: [0, 0, 0], trigger: 'none', keyframes: [], collisionShape: 'none'});

        return loader.instances().get(id);
    }
}

LightLanePresentation.VIRTUAL_WIDTH  = 1920;
LightLanePresentation.VIRTUAL_HEIGHT = 1080;
LightLanePresentation.HALF_TURN      = 180;
LightLanePresentation.CLIP_IDLE      = 'idle';
LightLanePresentation.CLIP_RUN       = 'run';
// The runner faces +z (glTF front), the way of the run.
LightLanePresentation.FACING         = Object.freeze([0, 0, 0]);
// The bloom works with the WebGL renderer only.
LightLanePresentation.BLOOM_RENDERER = 'webgl';
