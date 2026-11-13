/**
 * What the run shows (modelled on RacingPresentation): the screen and the engine on the renderer of the settings
 * (built again when the pause options change it: a canvas keeps one context type), the scene light and depth shading
 * of art § 2, the bloom when the setting asks for it (WebGL only), the camera (LightLaneCamera), the HUD
 * (LightLaneHud), the effects (LightLaneEffects), the track's tiles from pools of instances (holed under a gap), one
 * instance per element of the track (pooled by object, linked to its entity by serial), the runner, its clips and its
 * fragile blink. It reads the simulation and plays its events; it never writes the simulation.
 *
 * Plan step 8: 3 lanes; the sections of 5 lanes come with step 9.
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
        this._effects      = new LightLaneEffects();
        this._controls     = null;
        this._rendererCode = null;
        this._best         = 0;
        this._onPause      = null;
        this._shield       = null;
        this._runner       = null;
        this._model        = null;
        this._clip         = null;
        this._restart      = false;   // the next clip starts again even if it is the same (a new jump, a new slide)
        this._stumbleUntil = 0;
        this._hidden       = false;   // the runner shattered
        this._glowFaces    = [];
        this._fragileShown = false;
        this._time         = 0;
        this._rows         = [];      // pool slots: {row, codes: string[], tiles: Instance[], edge: Instance, far}
        this._backdrop     = null;
        this._farDecor     = Infinity;
        this._farLines     = Infinity;
        this._ids          = new Map();   // object code → id
        this._views        = new Map();   // entity → {serial, code, instance, far, frame}
        this._free         = new Map();   // object code → free instances
        this._frame        = 0;
        this._events       = [];      // the runner's clip events of a frame (footsteps: the sound, step 13)
        this._bloom        = {};      // the bloom's parameters: RendererWebglBloom.DEFAULTS
        this._facing       = [0, 0, 0];   // the runner's rotation, degrees: facing +z, its lean in z
        // The runner's light (test, LightLaneTuning.RUNNER_LIGHT_ON): its position moved in place every frame.
        this._light        = new Light([...LightLaneTuning.RUNNER_LIGHT_COLOR], (LightLaneTuning.RUNNER_LIGHT_RANGE * LightLaneTuning.RUNNER_HEIGHT / 2), [0, 0, 0]);
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
        LightLaneModels.compensate();
        this._model   = loader.animatedModels().getByCode(LightLaneModels.RUNNER);
        this._runner  = new AnimatedInstance(this._model).bind();
        // Its look kept under the ambient lowered for its own light.
        this._runner.getInstance().setRenderLight(LightLaneTuning.LIGHT_COMPENSATION);
        this._glowFaces = this._runner.getInstance().getObject().faceList.filter((face) => face.glow);
        const slots   = (Math.ceil((LightLaneTuning.TRACK_BEHIND + LightLaneTuning.TRACK_AHEAD) / LightLaneTuning.TILE_LENGTH) + 1);
        this._rows    = Array.from({length: slots}, () => ({
            row:   null,
            codes: LightLaneTuning.LANES_3.map(() => LightLaneModels.TILE),
            lit:   null,
            tiles: LightLaneTuning.LANES_3.map(() => LightLanePresentation.instance(this._id(LightLaneModels.TILE))),
            edge:  LightLanePresentation.instance(this._id(LightLaneModels.TILE_EDGE)),
            far:   false
        }));
        this._backdrop = LightLanePresentation.instance(this._id(LightLaneModels.BACKDROP));
        this._effects.bind();
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

    /**
     * @param {function(): int|null} source - the test mode shield's death count for the HUD (kept across renderer swaps)
     */
    setShieldSource(source) {
        this._shield = source;
        this._hud.setShieldSource(source);

        return this;
    }

    getEngine() {
        return this._engine;
    }

    getHud() {
        return this._hud;
    }

    getDisplay() {
        return this._screen.getDisplay();
    }

    // A new run: the camera onto the runner, the idle clip, the track's instances given back.
    newRun() {
        const simulation = this._simulation;
        this._camera.snap(simulation.getX(), simulation.getY(), simulation.getZ());
        this._effects.reset();
        for (const view of this._views.values()) {
            this._release(view);
        }
        this._views.clear();
        this._rows.forEach((slot) => {
            slot.row = null;
        });
        this._hidden       = false;
        this._facing[2]    = 0;
        this._stumbleUntil = 0;
        this._time         = 0;
        this._setFragile(false);
        this._clip = null;
        this._playClip(LightLanePresentation.CLIP_IDLE, 0, true, 1);
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
     * A frame: the simulation's events played, the runner's clip and pose, the camera, the effects, the scene drawn,
     * the HUD.
     *
     * @param {number}  dt      - s
     * @param {boolean} frozen  - nothing moves (the pause, the countdown of a resume)
     * @param {boolean} menuOpen
     */
    present(dt, frozen, menuOpen) {
        this.applyRendererSetting(menuOpen);
        const simulation = this._simulation;
        this._playEvents();
        if (!frozen) {
            this._time += dt;
            this._animateRunner(dt);
            this._camera.follow(dt, simulation.getX(), simulation.getY(), simulation.getZ(), simulation.getRunner().getLaneSide());
            this._effects.update(dt, this._engine);
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

    /**
     * @param {int} objectId
     * @returns {Instance} a new instance of the object, outside any batch
     */
    static instance(objectId) {
        const id = loader.instances().loadFromData(null, {object: objectId, position: [0, 0, 0], rotation: [0, 0, 0], trigger: 'none', keyframes: [], collisionShape: 'none'});

        return loader.instances().get(id);
    }

    // --- Events and the runner's clips (art § 6.2, § 7) ---

    _playEvents() {
        const events = this._simulation.getEvents();
        const runner = this._simulation.getRunner();
        for (let i = 0; i < events.getCount(); i++) {
            const event = events.get(i);
            switch (event.type) {
                case LightLaneEvents.JUMP:
                case LightLaneEvents.SLIDE:
                    this._restart = true;
                    break;
                case LightLaneEvents.STUMBLE:
                    this._stumbleUntil = (this._time + this._model.getClip(LightLanePresentation.CLIP_STUMBLE).getDuration());
                    this._restart      = true;
                    this._effects.shake(LightLaneTuning.STUMBLE_SHAKE);
                    break;
                case LightLaneEvents.DEATH:
                    this._effects.flash(LightLaneTuning.DEATH_FLASH[event.value]);
                    if (event.value === LightLaneRunner.DEATH_SHOCK) {
                        this._hidden = true;
                        this._effects.burst([runner.x, (runner.y + (LightLaneTuning.RUNNER_HEIGHT / 2)), this._simulation.getZ()], LightLaneTuning.SHARD_COUNT, LightLanePresentation.SHARD_PLAYER);
                        this._effects.shake(LightLaneTuning.DEATH_SHAKE);
                    } else if (event.value === LightLaneRunner.DEATH_FALL) {
                        this._camera.startFall();
                    }
                    break;
                default:
            }
        }
        events.clear();
    }

    // The clip the runner's state calls for (art § 6.2), its pace; the fragile blink.
    _animateRunner(dt) {
        const simulation = this._simulation;
        const runner     = simulation.getRunner();
        const state      = simulation.getState();
        if ((state === LightLaneSimulation.DYING) || (state === LightLaneSimulation.GAME_OVER)) {
            if (simulation.getDeath() !== LightLaneRunner.DEATH_SHOCK) {
                this._playClip(LightLanePresentation.CLIP_FALL, LightLaneTuning.FADE_SHORT_CLIP, false, 1);
            }
        } else if (state === LightLaneSimulation.RUNNING) {
            this._chooseRunningClip(runner, simulation.getSpeed());
        }
        this._setFragile(runner.isFragile() && ((Math.floor(this._time * LightLaneTuning.FRAGILE_BLINK_HZ * 2) % 2) === 0));
        // The lean of a lane change, over the run clip.
        const lean = (LightLanePresentation.LEAN_SIGN * runner.getLaneSide() * LightLaneTuning.RUNNER_LEAN);
        this._facing[2] += ((lean - this._facing[2]) * Math.min(1, (dt / LightLaneTuning.RUNNER_LEAN_TIME)));
        this._runner.place([simulation.getX(), simulation.getY(), simulation.getZ()], this._facing);
        this._events.length = 0;
        this._runner.update(dt, this._events);
    }

    _chooseRunningClip(runner, speed) {
        const fade = LightLaneTuning.FADE_SHORT_CLIP;
        if (runner.isSliding()) {
            this._playClip(LightLanePresentation.CLIP_SLIDE, fade, false, 1);
        } else if (runner.isJumping()) {
            this._playClip(LightLanePresentation.CLIP_JUMP, fade, false, ((runner.boots) ? LightLanePresentation.JUMP_HIGH_PACE : 1));
        } else if (this._time < this._stumbleUntil) {
            this._playClip(LightLanePresentation.CLIP_STUMBLE, fade, false, 1);
        } else {
            const pace = Math.min((LightLaneTuning.RUN_PACE_BASE + (((speed - LightLaneTuning.RUN_PACE_FROM) / LightLaneTuning.RUN_PACE_SPAN) * LightLaneTuning.RUN_PACE_GAIN)), LightLaneTuning.RUN_PACE_MAX);
            this._playClip(LightLanePresentation.CLIP_RUN, fade, true, pace);
            this._runner.getPlayer().setSpeed(pace);
        }
        this._restart = false;
    }

    _playClip(name, fade, loop, speed) {
        if ((this._clip === name) && !this._restart) {
            return;
        }
        this._clip    = name;
        this._restart = false;
        const options = {loop: loop, speed: speed};
        const clip    = this._model.getClip(name);
        if (fade > 0) {
            this._runner.getPlayer().crossFadeTo(clip, fade, options);
            return;
        }
        this._runner.getPlayer().play(clip, options);
    }

    // The runner's glowing faces in PLAYER_FRAGILE or PLAYER, written in place (art § 7).
    _setFragile(on) {
        if (on === this._fragileShown) {
            return;
        }
        this._fragileShown = on;
        const rgb = ((on) ? LightLaneTuning.COLOR.PLAYER_FRAGILE : LightLaneTuning.COLOR.PLAYER);
        for (const face of this._glowFaces) {
            face.color[0] = rgb[0];
            face.color[1] = rgb[1];
            face.color[2] = rgb[2];
        }
    }

    // --- Drawing ---

    _draw() {
        const engine = this._engine;
        const runner = this._simulation.getRunner();
        this._light.position[0] = runner.x;
        this._light.position[1] = (runner.y + (runner.getHeight() / 2));
        this._light.position[2] = this._simulation.getZ();
        engine.drawInit();
        this._camera.setView(engine, this._effects.offset);
        engine.lightsCalculatePosition();
        this._drawBackdrop();
        this._drawTrack();
        this._drawEntities();
        if (!this._hidden) {
            engine.drawInstance(this._runner.getInstance());
        }
        this._effects.draw(engine);
        engine.drawFinish();
    }

    // Each pool slot holds one row of tiles (row = floor(z / TILE_LENGTH)), placed when its row changes, holed under a
    // gap; the far variant past the distance where a line would be under LINE_FAR_PIXELS (art § 4).
    _drawTrack() {
        const engine = this._engine;
        const track  = this._simulation.getTrack();
        const z      = this._simulation.getZ();
        const length = LightLaneTuning.TILE_LENGTH;
        const first  = Math.floor((z - LightLaneTuning.TRACK_BEHIND) / length);
        const last   = Math.floor((z + LightLaneTuning.TRACK_AHEAD) / length);
        const camZ   = (z - LightLaneTuning.CAMERA_BACK);
        const y      = -LightLaneTuning.TILE_THICKNESS;
        const lanes  = LightLaneTuning.LANES_3;
        for (let row = first; row <= last; row++) {
            const slot   = this._rows[((row % this._rows.length) + this._rows.length) % this._rows.length];
            const start  = (row * length);
            const centre = (start + (length / 2));
            if (slot.row !== row) {
                slot.row = row;
                lanes.forEach((lane, i) => {
                    const gap = track.gapIn(lane, start);
                    slot.codes[i] = ((gap !== null) ? LightLaneModels.gapTileCode(gap) : LightLaneModels.TILE);
                    slot.tiles[i].setObject(this._id(this._tileVariant(slot.codes[i], slot.far, slot.lit)));
                    slot.tiles[i].placeAt((lane * LightLaneTuning.LANE_WIDTH), y, centre);
                });
                slot.edge.placeAt((lanes[lanes.length - 1] * LightLaneTuning.LANE_WIDTH), y, centre);
            }
            const far = this._isFar(slot.far, Math.abs(centre - camZ), this._farDecor);
            // Under the runner's light (art § 2): the runner's own row in fine cells, the next one in coarser cells,
            // every other row plain (user request: exactly one row of each).
            const runnerRow = Math.floor(z / length);
            const lit       = ((!LightLaneTuning.RUNNER_LIGHT_ON) ? null : ((row === runnerRow) ? LightLaneModels.LIT_SUFFIX : ((row === (runnerRow + 1)) ? LightLaneModels.MID_SUFFIX : null)));
            if ((far !== slot.far) || (lit !== slot.lit)) {
                slot.far = far;
                slot.lit = lit;
                slot.tiles.forEach((tile, i) => tile.setObject(this._id(this._tileVariant(slot.codes[i], far, lit))));
                slot.edge.setObject(this._id(LightLaneModels.TILE_EDGE + ((far) ? LightLaneModels.FAR_SUFFIX : '')));
            }
            for (const tile of slot.tiles) {
                engine.drawInstance(tile);
            }
            engine.drawInstance(slot.edge);
        }
    }

    // The backdrop at BACKDROP_NEAR ahead of the camera, scaled down as much (LightLaneTuning): seen as large as at
    // BACKDROP_DISTANCE, its ground on the horizon, its parallax across kept; then the depth cleared, the scene over it.
    _drawBackdrop() {
        const k   = (LightLaneTuning.BACKDROP_NEAR / LightLaneTuning.BACKDROP_DISTANCE);
        const cam = this._camera;
        this._backdrop.placeAt((cam.getX() * (1 - k)), (cam.getY() * (1 - k)), (cam.getZ() + LightLaneTuning.BACKDROP_NEAR));
        this._engine.drawInstance(this._backdrop);
        this._engine.clearDepth();
    }

    // One instance per element of the track, made or given back as the stream goes.
    _drawEntities() {
        const engine  = this._engine;
        const frame   = ++this._frame;
        const camZ    = (this._simulation.getZ() - LightLaneTuning.CAMERA_BACK);
        const runTime = this._simulation.getRunTime();
        for (const entity of this._simulation.getTrack().getActive()) {
            const code = LightLaneModels.obstacleCode(entity);
            if (code === null) {
                continue;
            }
            const coin   = (entity.kind === LightLaneEntity.COIN);
            const since  = (runTime - entity.takenAt);
            if (coin && entity.taken && (since >= LightLaneTuning.COIN_TAKE_TIME)) {
                continue;
            }
            let view = this._views.get(entity);
            if ((view !== undefined) && (view.serial !== entity.serial)) {
                this._release(view);
                view = undefined;
            }
            if (view === undefined) {
                view = {serial: entity.serial, code: code, instance: this._acquire(code), far: false, frame: frame};
                this._views.set(entity, view);
            }
            view.frame = frame;
            if (coin) {
                this._placeCoin(view.instance, entity, since);
            } else {
                const far = this._isFar(view.far, Math.abs((entity.z + (entity.length / 2)) - camZ), this._farLines);
                if (far !== view.far) {
                    view.far = far;
                    view.instance.setObject(this._id(code + ((far) ? LightLaneModels.FAR_SUFFIX : '')));
                }
                view.instance.placeAt(entity.x, 0, (entity.z + (entity.length / 2)));
            }
            engine.drawInstance(view.instance);
        }
        // The views of the elements gone (retired, or a coin faded out).
        for (const [entity, view] of this._views) {
            if (view.frame !== frame) {
                this._release(view);
                this._views.delete(entity);
            }
        }
    }

    // A coin spins and bobs (art § 5.2); picked up, it rises and fades out (art § 7).
    _placeCoin(instance, entity, since) {
        const phase = (entity.serial * LightLanePresentation.BOB_PHASE_STEP);
        const bob   = (LightLaneTuning.COIN_BOB * Math.sin((2 * Math.PI * LightLaneTuning.COIN_BOB_HZ * this._time) + phase));
        const taken = ((entity.taken) ? Math.min(1, (since / LightLaneTuning.COIN_TAKE_TIME)) : 0);
        instance.placeAt(entity.x, ((entity.y - LightLanePresentation.COIN_HALF_HEIGHT) + bob + (LightLaneTuning.COIN_TAKE_RISE * taken)), entity.z);
        instance.setRotation([0, ((LightLaneTuning.COIN_SPIN * this._time) % LightLanePresentation.FULL_TURN), 0]);
        instance.setRenderLight(1 - taken);
    }

    // A tile's object (plain or holed): its celled level near the runner's light (LIT_SUFFIX or MID_SUFFIX), else the
    // near or far one.
    _tileVariant(code, far, lit) {
        if (lit !== null) {
            return (code + lit);
        }

        return (code + ((far) ? LightLaneModels.FAR_SUFFIX : ''));
    }

    _isFar(wasFar, distance, threshold) {
        return ((wasFar) ? (distance > (LightLaneTuning.LINE_NEAR_RATIO * threshold)) : (distance > threshold));
    }

    _acquire(code) {
        const free = this._free.get(code);
        if ((free !== undefined) && (free.length > 0)) {
            return free.pop();
        }

        return LightLanePresentation.instance(this._id(code));
    }

    // Back to the pool of its own object (its near variant again).
    _release(view) {
        if (view.far) {
            view.instance.setObject(this._id(view.code));
        }
        view.instance.setRenderLight(1);
        if (!this._free.has(view.code)) {
            this._free.set(view.code, []);
        }
        this._free.get(view.code).push(view.instance);
    }

    _id(code) {
        let id = this._ids.get(code);
        if (id === undefined) {
            id = LightLaneModels.objectId(code);
            this._ids.set(code, id);
        }

        return id;
    }

    // The screen, the engine on the renderer of the settings, the HUD; the far-variant distances of the canvas.
    _buildDisplay() {
        this._rendererCode = lightLaneSettings.getRenderer();
        this._screen       = new ScreenManager('screen', {fullscreen: true, virtualWidth: LightLanePresentation.VIRTUAL_WIDTH, virtualHeight: LightLanePresentation.VIRTUAL_HEIGHT});
        this._engine       = new Engine3d(this._screen, new Object3dRendererList().getRenderer(this._rendererCode));
        this._engine.setFov(LightLaneTuning.CAMERA_FOV)
            .setZBuffer(LightLaneTuning.Z_NEAR, LightLaneTuning.Z_FAR)
            .setBackground(...LightLaneTuning.BACKGROUND)
            .setLightAmbient([...((LightLaneTuning.RUNNER_LIGHT_ON) ? LightLaneTuning.AMBIENT_LIT : LightLaneTuning.AMBIENT)])
            .setDepthShading({...LightLaneTuning.DEPTH_SHADING});
        if (LightLaneTuning.RUNNER_LIGHT_ON) {
            this._engine.addLight(this._light);
        }
        this._hud = new LightLaneHud(this._engine, this._simulation).setBest(this._best).setOnPause(this._onPause).setShieldSource(this._shield);
        this._screen.bindHud(this._hud);
        const focal    = (LightLanePresentation.VIRTUAL_WIDTH / (2 * Math.tan(LightLaneTuning.CAMERA_FOV * Math.PI / LightLanePresentation.HALF_TURN)));
        this._farDecor = ((focal * LightLaneTuning.LINE_SIZE_DECOR) / LightLaneTuning.LINE_FAR_PIXELS);
        this._farLines = ((focal * LightLaneTuning.LINE_SIZE) / LightLaneTuning.LINE_FAR_PIXELS);
        this._rows.forEach((slot) => {
            slot.row = null;
        });
    }
}

LightLanePresentation.VIRTUAL_WIDTH   = 1920;
LightLanePresentation.VIRTUAL_HEIGHT  = 1080;
LightLanePresentation.HALF_TURN       = 180;
LightLanePresentation.FULL_TURN       = 360;
LightLanePresentation.CLIP_IDLE       = 'idle';
LightLanePresentation.CLIP_RUN        = 'run';
LightLanePresentation.CLIP_JUMP       = 'jump';
LightLanePresentation.CLIP_SLIDE      = 'slide';
LightLanePresentation.CLIP_STUMBLE    = 'stumble';
LightLanePresentation.CLIP_FALL       = 'fall';
// jumpHigh (boots): the jump clip played at this pace (art § 6.2).
LightLanePresentation.JUMP_HIGH_PACE  = 0.79;
LightLanePresentation.SHARD_PLAYER    = 'Player';
// The coin object stands on its bottom; its entity gives its centre.
LightLanePresentation.COIN_HALF_HEIGHT = 0.16;
// Coins bob out of step: phase step per serial, radians.
LightLanePresentation.BOB_PHASE_STEP  = 1.7;
// Rotation about z that leans the runner towards a move to the right (Instance.setRotation's sign).
LightLanePresentation.LEAN_SIGN       = -1;
// The city's facades stand this far (apparent metres) behind the horizon band, its lines this much before them.
LightLanePresentation.BACKDROP_LAYER     = 2;
LightLanePresentation.BACKDROP_LINE_LIFT = 0.01;
// The bloom works with the WebGL renderer only.
LightLanePresentation.BLOOM_RENDERER  = 'webgl';
