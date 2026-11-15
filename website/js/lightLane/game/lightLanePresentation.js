/**
 * What the run shows (modelled on RacingPresentation): the screen and the engine on the renderer of the settings
 * (built again when the pause options change it: a canvas keeps one context type), the scene light and depth shading
 * of art § 2, the bloom when the setting asks for it (WebGL only), the camera (LightLaneCamera), the HUD
 * (LightLaneHud), the effects (LightLaneEffects), the track's tiles from pools of instances (3 or 5 lanes, holed under a
 * gap with the hole's walls beside, the warning zone's blinking red edges and chevrons), one instance per element of
 * the track (pooled by object, linked to its entity by serial; an enemy at its moving front, a stalker's floor arrow
 * while it announces its move), the Sentinel and its shots (marks, column, sweeps), the runner, its clips and its fragile
 * blink. It reads the simulation and plays its events; it never writes the simulation. Bonuses are drawn from plan
 * step 12.
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
        this._fog          = null;
        this._controls     = null;
        this._rendererCode = null;
        this._best         = null;
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
        this._rows         = [];      // pool slots: {row, lit, parts: [{instance, code, litable, blink}]}
        this._trackFree    = new Map();   // a track part's base code → free instances
        this._lanesGaps    = LightLaneTuning.LANES_5.map(() => null);   // the gap codes of a row's lanes, reused
        this._ids          = new Map();   // object code → id
        this._views        = new Map();   // entity → {serial, code, instance, frame}
        this._arrows       = new Map();   // a stalker → its floor arrow's view, same form
        this._trailViews   = [];          // records of the trails' pieces {code, instance}, reused: those under _trailCount drawn this frame
        this._trailCount   = 0;
        this._sentinel     = null;        // the Sentinel's instances: {ship, mark, beam, frame, ray}
        this._free         = new Map();   // object code → free instances
        this._frame        = 0;
        this._events       = [];      // the runner's clip events of a frame (footsteps: the sound, step 14)
        this._bloom        = {glowDepthShading: LightLaneTuning.BLOOM_GLOW_DEPTH_SHADING, glowFar: LightLaneTuning.BLOOM_GLOW_FAR,
            glowFarMax: LightLaneTuning.BLOOM_GLOW_FAR_MAX};   // RendererWebglBloom.DEFAULTS otherwise
        this._facing       = [0, 0, 0];   // the runner's rotation, degrees: facing +z, its lean in z
        this._enemyAngles  = [0, 0, 0];   // an enemy's rotation, degrees, written in place
        this._trailAngles  = [0, 0, 0];   // a trail piece's rotation, degrees, written in place
        this._coinAngles   = [0, 0, 0];   // a coin's spin, degrees, written in place
        this._sweepFrame   = 0;           // the frame whose views are kept (the others released)
        // Bound once (no closure a frame): a view not drawn this frame goes back to its pool.
        this._sweepView    = (view, entity) => this._sweepOut(this._views, view, entity);
        this._sweepArrow   = (view, entity) => this._sweepOut(this._arrows, view, entity);
        // The runner's light: its position moved in place every frame.
        this._lightRange   = (LightLaneTuning.RUNNER_LIGHT_RANGE * LightLaneTuning.RUNNER_HEIGHT / 2);
        this._light        = new Light([...LightLaneTuning.RUNNER_LIGHT_COLOR], this._lightRange, [0, 0, 0]);
        this._deathLight   = null;    // {time, duration} from a death on: the light flares, then dies down
    }

    /**
     * Inside the loader batch.
     *
     * @param {boolean} lod - the tiles coloured by level of detail (the test mode's `lod`)
     */
    build(lod = false) {
        LightLaneModels.load(lod);

        return this;
    }

    /**
     * The scene loaded: the screen, the engine, the HUD, the instances.
     *
     * @param {{score: int, distance: int, coins: int, time: int|null}|null} best - the record shown on the HUD
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
        this._rows    = Array.from({length: slots}, () => ({row: null, lit: null, parts: []}));
        this._fog     = LightLanePresentation.instance(this._id(LightLaneModels.FOG));
        this._sentinel = {
            ship:  LightLanePresentation.instance(this._id(LightLaneModels.SENTINEL)),
            mark:  LightLanePresentation.instance(this._id(LightLaneModels.STRIKE_MARK + 1)),
            beam:  LightLanePresentation.instance(this._id(LightLaneModels.STRIKE_BEAM)),
            frame: LightLanePresentation.instance(this._id(LightLaneModels.sweepCode(true, 0, LightLanePresentation.LOW))),
            ray:   LightLanePresentation.instance(this._id(LightLaneModels.sweepCode(false, 0, LightLanePresentation.LOW))),
        };
        this._sentinel.mark.setRenderDepthBias(LightLaneTuning.FLOOR_DEPTH_BIAS);
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

    /**
     * @param {{score: int, distance: int, coins: int, time: int|null}|null} best - the record, kept for a HUD built again
     *        (a renderer changed in the pause)
     */
    setBest(best) {
        this._best = best;
        this._hud.setBest(best);

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
        for (const view of this._arrows.values()) {
            this._release(view);
        }
        this._arrows.clear();
        this._releaseTrails();
        this._rows.forEach((slot) => this._clearSlot(slot));
        this._hidden       = false;
        this._deathLight   = null;
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
            if (this._deathLight !== null) {
                this._deathLight.time += dt;
            }
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

    // The background picture as the engine's sky, in its own proportions: SKY_SPAN degrees across, as many a pixel
    // upwards, SKY_HORIZON_ROW on the horizon (elevations in radians).
    static _sky() {
        const perRow = ((LightLaneTuning.SKY_SPAN * Math.PI / LightLanePresentation.HALF_TURN) / LightLaneTuning.SKY_WIDTH_PX);

        return {
            loaderId:    LightLaneModels.skyId(),
            wrap:        (LightLanePresentation.FULL_TURN / LightLaneTuning.SKY_SPAN),
            top:         (LightLaneTuning.SKY_HORIZON_ROW * perRow),
            bottom:      (-(LightLaneTuning.SKY_HEIGHT_PX - LightLaneTuning.SKY_HORIZON_ROW) * perRow),
            mirrorBelow: false,
            followRoll:  true
        };
    }

    /**
     * @param {int} objectId
     * @returns {Instance} a new instance of the object, outside any batch
     */
    static instance(objectId) {
        // Spawned: finalised alone (loadFromData would rerun the whole loader's load check at each of the pools' hundreds
        // of instances, seconds before the first frame).
        const id = loader.instances().spawnFromData(null, {object: objectId, position: [0, 0, 0], rotation: [0, 0, 0], trigger: 'none', keyframes: [], collisionShape: 'none'});

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
                    // Shown once on the ground: a stumble in the air keeps the jump (or slide) clip where it is.
                    this._stumbleUntil = (this._time + this._model.getClip(LightLanePresentation.CLIP_STUMBLE).getDuration());
                    this._restart      = !(runner.isJumping() || runner.isSliding());
                    this._effects.shake(LightLaneTuning.STUMBLE_SHAKE);
                    break;
                case LightLaneEvents.STRIKE:
                    this._effects.flash(LightLaneTuning.STRIKE_FLASH);
                    break;
                case LightLaneEvents.DEATH:
                    this._effects.flash(LightLaneTuning.DEATH_FLASH[event.value]);
                    this._deathLight = {time: 0, duration: LightLaneTuning.DYING_TIME[event.value]};
                    if (event.value === LightLaneRunner.DEATH_SHOCK) {
                        this._hidden = true;
                        this._effects.burst([runner.getX(), (runner.getY() + (LightLaneTuning.RUNNER_HEIGHT / 2)), this._simulation.getZ()], LightLaneTuning.SHARD_COUNT, LightLanePresentation.SHARD_PLAYER);
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
        this._facing[2] += ((lean - this._facing[2]) * LightLaneCamera.ease(dt, LightLaneTuning.RUNNER_LEAN_TIME));
        this._runner.place([simulation.getX(), simulation.getY(), simulation.getZ()], this._facing);
        this._events.length = 0;
        this._runner.update(dt, this._events);
    }

    _chooseRunningClip(runner, speed) {
        const fade = LightLaneTuning.FADE_SHORT_CLIP;
        if (runner.isSliding()) {
            this._playClip(LightLanePresentation.CLIP_SLIDE, fade, false, 1);
        } else if (runner.isJumping()) {
            this._playClip(LightLanePresentation.CLIP_JUMP, fade, false, ((runner.hasBoots()) ? LightLaneTuning.JUMP_HIGH_PACE : 1));
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
        // The sky pass reads the view's angles (Engine3d.setCamera fills them; this camera sets the matrix itself):
        // the picture's anchor (its central building's base) kept on the track's far end, SKY_DISTANCE ahead — seen
        // atan(y / d) under the horizon (a higher camera, in a jump, sees it lower) and atan(−x / d) aside; its middle
        // straight ahead (the sky starts its texture at yaw 0, half a span to the left).
        const toDegrees = (LightLanePresentation.HALF_TURN / Math.PI);
        engine.viewPitch = (this._camera.getPitch() + (Math.atan(this._camera.getY() / LightLaneTuning.SKY_DISTANCE) * toDegrees));
        engine.viewYaw   = ((LightLaneTuning.SKY_SPAN / 2) + (Math.atan(this._camera.getX() / LightLaneTuning.SKY_DISTANCE) * toDegrees));
        engine.viewRoll  = this._camera.getRoll();
        const runner = this._simulation.getRunner();
        this._light.position[0] = runner.getX();
        this._light.position[1] = (runner.getY() + (runner.getHeight() / 2));
        this._light.position[2] = this._simulation.getZ();
        this._applyLightLevel();
        engine.drawInit();
        this._camera.setView(engine, this._effects.offset);
        engine.lightsCalculatePosition();
        this._drawFog();
        this._drawTrack();
        this._drawEntities();
        this._drawSentinel();
        if (!this._hidden) {
            engine.drawInstance(this._runner.getInstance());
        }
        this._effects.draw(engine);
        engine.drawFinish();
    }

    // Each pool slot holds one row of tiles (row = floor(z / TILE_LENGTH)), laid out again when its row changes: a whole
    // row in one tile when no lane has a gap, else a tile a lane (holed under a gap, the hole's walls beside); the right
    // edge; in a warning zone the outer lanes' red edges (blinking) and its chevrons. Its tops in cells under the
    // runner's light.
    _drawTrack() {
        const engine = this._engine;
        const z      = this._simulation.getZ();
        const length = LightLaneTuning.TILE_LENGTH;
        const first  = Math.floor((z - LightLaneTuning.TRACK_BEHIND) / length);
        const last   = Math.floor((z + LightLaneTuning.TRACK_AHEAD) / length);
        const blink  = ((Math.floor(this._time * LightLaneTuning.WARN_BLINK_HZ * 2) % 2) === 0);
        for (let row = first; row <= last; row++) {
            const slot = this._rows[((row % this._rows.length) + this._rows.length) % this._rows.length];
            if (slot.row !== row) {
                this._layOutRow(slot, row);
            }
            // Under the runner's light (art § 2), by half tile (a mark every half tile shows it as a row): fine where the
            // light falls and the camera sees, one coarser half tile after, all the rest plain (user requests).
            const lit = LightLanePresentation._litLevel(row, z, this._lightRange);
            if (lit !== slot.lit) {
                slot.lit = lit;
                for (const part of slot.parts) {
                    if (part.litable) {
                        part.instance.setObject(this._id(this._tileVariant(part.code, lit)));
                    }
                }
            }
            for (const part of slot.parts) {
                if (!part.blink || blink) {
                    engine.drawInstance(part.instance);
                }
            }
        }
    }

    _layOutRow(slot, row) {
        const track  = this._simulation.getTrack();
        const length = LightLaneTuning.TILE_LENGTH;
        const start  = (row * length);
        const centre = (start + (length / 2));
        const width  = LightLaneTuning.LANE_WIDTH;
        const y      = -LightLaneTuning.TILE_THICKNESS;
        const lanes  = LightLaneTuning.LANES_5;
        const gaps   = this._lanesGaps;
        const outer  = LightLaneTrackGenerator.OUTER;
        const five   = track.laneExistsAt(outer, start);
        const opens  = (five && track.isOuterStart(start));
        let holed    = false;
        this._clearSlot(slot);
        slot.row = row;
        for (let i = 0; i < lanes.length; i++) {
            gaps[i] = ((five || (Math.abs(lanes[i]) < outer)) ? track.gapIn(lanes[i], start) : null);
            holed   = (holed || (gaps[i] !== null));
        }
        if (!holed && !opens) {
            this._addPart(slot, ((five) ? LightLaneModels.ROW5 : LightLaneModels.ROW3), true, false, 0, y, centre);
        } else {
            for (let i = 0; i < lanes.length; i++) {
                const lane = lanes[i];
                if (!five && (Math.abs(lane) === outer)) {
                    continue;
                }
                if (gaps[i] === null) {
                    const front = (opens && (Math.abs(lane) === outer));
                    this._addPart(slot, ((front) ? LightLaneModels.TILE_FRONT : LightLaneModels.TILE), true, false, (lane * width), y, centre);
                    continue;
                }
                this._addPart(slot, LightLaneModels.gapTileCode(gaps[i]), true, false, (lane * width), y, centre);
                // The neighbours' flanks seen through the hole, where a neighbour lane's top flanks it.
                for (const side of LightLanePresentation.SIDES) {
                    const neighbour = (i + side);
                    const exists    = ((neighbour >= 0) && (neighbour < lanes.length) && (five || (Math.abs(lanes[neighbour]) < outer)));
                    const kind      = ((!exists) ? null : ((gaps[neighbour] !== null) ? gaps[neighbour] : LightLaneModels.TILE));
                    for (const wall of LightLaneModels.holeWalls(gaps[i], side, kind)) {
                        this._addPart(slot, wall, false, false, ((lane * width) + (side * width / 2)), y, centre);
                    }
                }
            }
        }
        const right = ((five) ? outer : LightLaneTrackGenerator.MIDDLE);
        const edge  = gaps[lanes.indexOf(right)];
        this._addPart(slot, ((edge !== null) ? LightLaneModels.tileEdgeCode(edge) : LightLaneModels.TILE_EDGE), false, false, (right * width), y, centre);
        // The warning zone before the outer lanes end (generation § 3): their red edges blink, chevrons at its start.
        for (const side of LightLanePresentation.SIDES) {
            const lane = (side * outer);
            if (track.isWarnTile(lane, start)) {
                this._addPart(slot, LightLaneModels.WARN_EDGES, false, true, (lane * width), y, centre);
            }
            if (track.isWarnStart(start)) {
                const arrow = ((side < 0) ? LightLaneModels.ARROW_SIDES[1][0] : LightLaneModels.ARROW_SIDES[0][0]);
                this._addPart(slot, (LightLaneModels.ARROW + arrow), false, false, (lane * width), y, (start + LightLaneTuning.ARROW_SIZE[0]));
            }
        }
        slot.lit = null;
    }

    // A track part of the slot: an instance of the object `code` (a tile's base code when litable: its variant under
    // the light is set by _drawTrack), placed at (x, y, z).
    _addPart(slot, code, litable, blink, x, y, z) {
        const free     = this._trackFree.get(code);
        const instance = (((free !== undefined) && (free.length > 0)) ? free.pop() : LightLanePresentation.instance(this._id(code)));
        instance.setObject(this._id(code));
        instance.placeAt(x, y, z);
        slot.parts.push({instance: instance, code: code, litable: litable, blink: blink});
    }

    // The slot's parts back to their pools.
    _clearSlot(slot) {
        for (const part of slot.parts) {
            if (!this._trackFree.has(part.code)) {
                this._trackFree.set(part.code, []);
            }
            this._trackFree.get(part.code).push(part.instance);
        }
        slot.parts.length = 0;
        slot.row          = null;
        slot.lit          = null;
    }

    // The fog plane under the track, stepped by whole mirrored pairs of cells along the run: it stays put in the world.
    _drawFog() {
        const pair = (2 * LightLaneTuning.FOG_TILE[1]);
        const z    = this._simulation.getZ();
        this._fog.placeAt(0, -LightLaneTuning.FOG_DEPTH, (Math.floor((z - LightLaneTuning.FOG_BEHIND) / pair) * pair));
        this._engine.drawInstance(this._fog);
    }

    // One instance per element of the track, made or given back as the stream goes.
    _drawEntities() {
        const engine  = this._engine;
        const frame   = ++this._frame;
        const runTime = this._simulation.getRunTime();
        const z       = this._simulation.getZ();
        const blink   = ((Math.floor(this._time * LightLaneTuning.WARN_BLINK_HZ * 2) % 2) === 0);
        this._releaseTrails();
        for (const entity of this._simulation.getTrack().getActive()) {
            let code = LightLaneModels.obstacleCode(entity, blink);
            if (code === null) {
                continue;
            }
            // An enemy shows once it is within ENEMY_SHOWN (generation § 5), at its moving front.
            if (entity.isEnemy()) {
                if ((entity.getFront() - z) > LightLaneTuning.ENEMY_SHOWN) {
                    continue;
                }
                // A bike that has passed the runner, kept while its trail is still ahead (user request): its trail only.
                if (entity.getEnd() >= (z - LightLaneTuning.RETIRE_BEHIND)) {
                    this._drawEnemy(entity, code, frame);
                }
                this._drawTrail(entity);
                continue;
            }
            // A block shows its side crosses on the side the camera sees.
            if (entity.getKind() === LightLaneEntity.BLOCK) {
                code = LightLaneModels.blockSideCode(entity.getCode(), ((this._camera.getX() < entity.getX()) ? -1 : 1));
            }
            const coin   = (entity.getKind() === LightLaneEntity.COIN);
            const since  = (runTime - entity.getTakenAt());
            if (coin && entity.isTaken() && (since >= LightLaneTuning.COIN_TAKE_TIME)) {
                continue;
            }
            const view = this._view(this._views, entity, code, frame);
            if (coin) {
                this._placeCoin(view.instance, entity, since);
            } else {
                view.instance.placeAt(entity.getX(), 0, (entity.getZ() + (entity.getLength() / 2)));
            }
            engine.drawInstance(view.instance);
        }
        // The views of the elements gone (retired, or a coin faded out).
        this._sweepFrame = frame;
        this._views.forEach(this._sweepView);
        this._arrows.forEach(this._sweepArrow);
    }

    // An enemy at its moving front; a stalker announcing its move: its floor arrow on the lane it goes to, before it.
    _drawEnemy(entity, code, frame) {
        const view    = this._view(this._views, entity, code, frame);
        // Leaning into its move across, its heading kept (user request); pivot at its bottom: the wheels stay on the track.
        const lean = Math.max(-LightLaneTuning.ENEMY_LEAN_MAX, Math.min(LightLaneTuning.ENEMY_LEAN_MAX, (entity.getHeading() * LightLaneTuning.ENEMY_LEAN)));
        this._enemyAngles[2] = (LightLanePresentation.ENEMY_LEAN_SIGN * lean);
        view.instance.setRotation(this._enemyAngles);
        view.instance.placeAt(entity.getX(), 0, (entity.getFront() + (entity.getLength() / 2)));
        this._engine.drawInstance(view.instance);
        if (!entity.isWarning()) {
            return;
        }
        const side  = ((entity.getToLane() < entity.getLane()) ? LightLaneModels.ARROW_SIDES[0][0] : LightLaneModels.ARROW_SIDES[1][0]);
        const arrow = this._view(this._arrows, entity, (LightLaneModels.STALKER_ARROW + side), frame);
        arrow.instance.placeAt((entity.getToLane() * LightLaneTuning.LANE_WIDTH), -LightLaneTuning.TILE_THICKNESS, (entity.getFront() - LightLaneTuning.STALKER_ARROW_AHEAD));
        this._engine.drawInstance(arrow.instance);
    }

    /**
     * A bike's light trail (gameplay § 6.3): from its back, TRAIL_LENGTH along the path it left, band by band
     * (TRAIL_FADE); straight runs in long pieces, the curve of a lane change in short ones turned along it.
     */
    _drawTrail(entity) {
        if (!entity.hasTrail()) {
            return;
        }
        const start  = entity.getTrailStart();
        const band   = (LightLaneTuning.TRAIL_LENGTH / LightLaneTuning.TRAIL_BANDS);
        const body   = (LightLaneTuning.TRAIL_LENGTH - LightLaneTuning.TRAIL_TAIL);
        const angles = this._trailAngles;
        let s        = 0;
        while (s < (body - LightLanePresentation.EPSILON)) {
            const index = Math.min((LightLaneTuning.TRAIL_BANDS - 1), Math.floor((s + LightLanePresentation.EPSILON) / band));
            const long  = LightLaneTuning.TRAIL_PIECE_LONG;
            const end   = ((index + 1) * band);
            const x0    = entity.trailX(start + s);
            const fits  = (((s + long) <= (Math.min(end, body) + LightLanePresentation.EPSILON)) && (Math.abs(entity.trailX(start + s + long) - x0) < LightLanePresentation.EPSILON)
                && (Math.abs(entity.trailX(start + s + (long / 2)) - x0) < LightLanePresentation.EPSILON));
            const length = ((fits) ? long : LightLaneTuning.TRAIL_PIECE_SHORT);
            // A piece turned along a curve runs its length on the path: it covers less along z, the next starts there.
            const slope  = ((entity.trailX(start + s + length) - x0) / length);
            const along  = (length / Math.sqrt(1 + (slope * slope)));
            const x1     = entity.trailX(start + s + along);
            const code   = LightLaneModels.trailCode(index, length);
            const piece  = this._trailPiece(code);
            angles[1] = (Math.atan2((x1 - x0), along) * LightLanePresentation.HALF_TURN / Math.PI);
            piece.instance.setRotation(angles);
            piece.instance.placeAt(((x0 + x1) / 2), 0, (start + s + (along / 2)));
            this._engine.drawInstance(piece.instance);
            s += along;
        }
        // Its tail always ends where the deadly trail does (a body's last short piece may run up to one into it).
        this._drawTrailTail(entity, (start + body));
    }

    // The trail's last TRAIL_TAIL metres from `from`, its end rounded like the wheel (user request): one piece on a
    // straight run, else all its slices along the curve.
    _drawTrailTail(entity, from) {
        const length   = LightLaneTuning.TRAIL_TAIL;
        const x0       = entity.trailX(from);
        const straight = ((Math.abs(entity.trailX(from + length) - x0) < LightLanePresentation.EPSILON) && (Math.abs(entity.trailX(from + (length / 2)) - x0) < LightLanePresentation.EPSILON));
        const angles   = this._trailAngles;
        if (straight) {
            const piece = this._trailPiece(LightLaneModels.TRAIL_TAIL);
            angles[1] = 0;
            piece.instance.setRotation(angles);
            piece.instance.placeAt(x0, 0, (from + (length / 2)));
            this._engine.drawInstance(piece.instance);
            return;
        }
        const slice = (LightLaneTuning.TRAIL_TAIL / LightLaneTuning.TRAIL_TAIL_SLICES);
        let s       = 0;
        for (let k = 0; k < LightLaneTuning.TRAIL_TAIL_SLICES; k++) {
            const xa    = entity.trailX(from + s);
            const slope = ((entity.trailX(from + s + slice) - xa) / slice);
            const along = (slice / Math.sqrt(1 + (slope * slope)));
            const xb    = entity.trailX(from + s + along);
            const code  = LightLaneModels.trailTailCode(k);
            const piece = this._trailPiece(code);
            angles[1] = (Math.atan2((xb - xa), along) * LightLanePresentation.HALF_TURN / Math.PI);
            piece.instance.setRotation(angles);
            piece.instance.placeAt(((xa + xb) / 2), 0, (from + s + (along / 2)));
            this._engine.drawInstance(piece.instance);
            s += along;
        }
    }

    // A trail's piece for this frame: an instance of the object `code` in a reused record.
    _trailPiece(code) {
        if (this._trailCount === this._trailViews.length) {
            this._trailViews.push({code: null, instance: null});
        }
        const piece    = this._trailViews[this._trailCount++];
        piece.code     = code;
        piece.instance = this._acquire(code);

        return piece;
    }

    // The trails' pieces of the last frame back to their pools (their records kept).
    _releaseTrails() {
        for (let i = 0; i < this._trailCount; i++) {
            this._release(this._trailViews[i]);
            this._trailViews[i].instance = null;
        }
        this._trailCount = 0;
    }

    // The view of an entity in a map of views, made or remade for its serial and object.
    _view(views, entity, code, frame) {
        let view = views.get(entity);
        if ((view !== undefined) && ((view.serial !== entity.getSerial()) || (view.code !== code))) {
            this._release(view);
            view = undefined;
        }
        if (view === undefined) {
            view = {serial: entity.getSerial(), code: code, instance: this._acquire(code), frame: frame};
            views.set(entity, view);
        }
        view.frame = frame;

        return view;
    }

    // The Sentinel over the track (gameplay § 7.1) and its attack under way: a strike's mark (growing, blinking at the
    // end), its column, its fading trace; a sweep's frame (blinking), then its ray. Before the runner, who keeps running.
    _drawSentinel() {
        const sentinel = this._simulation.getSentinel();
        if (!sentinel.isActive()) {
            return;
        }
        const engine = this._engine;
        const views  = this._sentinel;
        const z      = this._simulation.getZ();
        const attack = sentinel.getAttack();
        const t      = sentinel.getAttackTime();
        const strike = (attack === LightLaneSentinel.STRIKE);
        const firing = (strike && (t < (LightLaneTuning.STRIKE_WARN + LightLaneTuning.STRIKE_TIME)));
        views.ship.setObject(this._id((firing) ? LightLaneModels.SENTINEL_STRIKE : LightLaneModels.SENTINEL));
        views.ship.placeAt(sentinel.getX(), sentinel.getY(), (z + sentinel.getAhead()));
        engine.drawInstance(views.ship);
        if (strike) {
            this._drawStrike(sentinel, t, z);
        } else if (attack !== null) {
            this._drawSweep(sentinel, attack, t, z);
        }
    }

    _drawStrike(sentinel, t, z) {
        const views = this._sentinel;
        const warn  = LightLaneTuning.STRIKE_WARN;
        const from  = (z - LightLaneTuning.STRIKE_MARK[0]);
        const steps = LightLaneTuning.STRIKE_WIDTHS.length;
        if (t < warn) {
            const blinking = (t > (warn - LightLaneTuning.STRIKE_BLINK));
            if (blinking && ((Math.floor(t * LightLaneTuning.STRIKE_BLINK_HZ * 2) % 2) === 1)) {
                return;
            }
            views.mark.setObject(this._id(LightLaneModels.STRIKE_MARK + Math.min(steps, (1 + Math.floor((t / warn) * steps)))));
            views.mark.setRenderLight(1);
            views.mark.placeAt(sentinel.getAimX(), -LightLaneTuning.TILE_THICKNESS, from);
            this._engine.drawInstance(views.mark);
            return;
        }
        const after = (t - warn);
        if (after < LightLaneTuning.STRIKE_TIME) {
            views.beam.placeAt(sentinel.getAimX(), -LightLaneTuning.TILE_THICKNESS, from);
            this._engine.drawInstance(views.beam);
        }
        // The trace dies out after the column.
        const fade = Math.max(0, (1 - (Math.max(0, (after - LightLaneTuning.STRIKE_TIME)) / LightLaneTuning.STRIKE_TRACE)));
        views.mark.setObject(this._id(LightLaneModels.STRIKE_MARK + steps));
        views.mark.setRenderLight(fade);
        views.mark.placeAt(sentinel.getAimX(), -LightLaneTuning.TILE_THICKNESS, from);
        this._engine.drawInstance(views.mark);
    }

    _drawSweep(sentinel, attack, t, z) {
        const views  = this._sentinel;
        const height = LightLaneSentinel.HEIGHT[attack];
        const wide   = ((this._simulation.laneExists(LightLaneTrackGenerator.OUTER)) ? 1 : 0);
        if (t < LightLaneTuning.SWEEP_WARN) {
            if ((Math.floor(t * LightLaneTuning.SWEEP_BLINK_HZ * 2) % 2) === 1) {
                return;
            }
            views.frame.setObject(this._id(LightLaneModels.sweepCode(true, wide, height)));
            views.frame.placeAt(0, -LightLaneTuning.TILE_THICKNESS, (z + LightLaneTuning.SWEEP_AHEAD));
            this._engine.drawInstance(views.frame);
            return;
        }
        views.ray.setObject(this._id(LightLaneModels.sweepCode(false, wide, height)));
        views.ray.placeAt(0, -LightLaneTuning.TILE_THICKNESS, (z + sentinel.getSweepAhead()));
        this._engine.drawInstance(views.ray);
    }

    // A coin spins and bobs (art § 5.2); picked up, it rises and fades out (art § 7).
    _placeCoin(instance, entity, since) {
        const phase = (entity.getSerial() * LightLaneTuning.COIN_BOB_PHASE_STEP);
        const bob   = (LightLaneTuning.COIN_BOB * Math.sin((2 * Math.PI * LightLaneTuning.COIN_BOB_HZ * this._time) + phase));
        const taken = ((entity.isTaken()) ? Math.min(1, (since / LightLaneTuning.COIN_TAKE_TIME)) : 0);
        // Picked up, it goes on with the runner, just before it, rising and fading (art § 7).
        const z     = ((entity.isTaken()) ? (this._simulation.getZ() + Math.max(entity.getTakenDz(), LightLaneTuning.COIN_TAKE_AHEAD)) : entity.getZ());
        instance.placeAt(entity.getX(), ((entity.getY() - LightLaneTuning.SHAPES.COIN.halfHeight) + bob + (LightLaneTuning.COIN_TAKE_RISE * taken)), z);
        this._coinAngles[1] = ((LightLaneTuning.COIN_SPIN * this._time) % LightLanePresentation.FULL_TURN);
        instance.setRotation(this._coinAngles);
        instance.setRenderLight(1 - taken);
    }

    // The runner's light: as it is, or after a death flaring to DEATH_LIGHT_PEAK in DEATH_LIGHT_RISE, then dying down to
    // nothing by the end of the dying (user request); its range follows the flare.
    _applyLightLevel() {
        let level = 1;
        if (this._deathLight !== null) {
            const rise = LightLaneTuning.DEATH_LIGHT_RISE;
            const peak = LightLaneTuning.DEATH_LIGHT_PEAK;
            const t    = this._deathLight.time;
            level = ((t < rise) ? (1 + ((peak - 1) * (t / rise))) : (peak * Math.max(0, (1 - ((t - rise) / Math.max(rise, (this._deathLight.duration - rise)))))));
        }
        const base = LightLaneTuning.RUNNER_LIGHT_COLOR;
        for (let i = 0; i < 3; i++) {
            this._light.color[i] = (base[i] * level);
        }
        const flare = Math.min(1, Math.max(0, ((level - 1) / (LightLaneTuning.DEATH_LIGHT_PEAK - 1))));
        this._light.range = (this._lightRange * (1 + ((LightLaneTuning.DEATH_LIGHT_RANGE - 1) * flare)));
    }

    // A tile's object (plain or holed): its celled variant near the runner's light (LightLaneModels.LIT_LEVELS), else
    // its plain one.
    _tileVariant(code, lit) {
        if (lit !== null) {
            return (code + lit);
        }

        return code;
    }

    /**
     * The fine halves: every half tile the runner's light reaches, or soon will, that the camera sees (from
     * GROUND_SEEN_BEHIND behind the runner to the light's range + FINE_AHEAD_MARGIN ahead), one or two; then one coarser
     * half; the rest plain.
     *
     * @param {int}    row   - a tile's row
     * @param {number} z     - the runner's z
     * @param {number} reach - the light's range
     * @returns {string|null} its LightLaneModels.LIT_LEVELS variant, null when both halves are plain
     */
    static _litLevel(row, z, reach) {
        const size  = (LightLaneTuning.TILE_LENGTH / 2);
        const first = Math.floor((z - LightLaneTuning.GROUND_SEEN_BEHIND) / size);
        const last  = Math.floor((z + reach + LightLaneTuning.FINE_AHEAD_MARGIN) / size);
        const level = LightLanePresentation._halfLevel;

        return LightLanePresentation.LIT_CODES[level((2 * row), first, last)][level(((2 * row) + 1), first, last)];
    }

    // A half tile's level: 0 fine (F), 1 the coarser one after (M), 2 plain (P).
    static _halfLevel(half, first, last) {
        if ((half >= first) && (half <= last)) {
            return 0;
        }

        return ((half === (last + 1)) ? 1 : 2);
    }

    _sweepOut(views, view, entity) {
        if (view.frame !== this._sweepFrame) {
            this._release(view);
            views.delete(entity);
        }
    }

    _acquire(code) {
        const free = this._free.get(code);
        if ((free !== undefined) && (free.length > 0)) {
            return free.pop();
        }

        return LightLanePresentation.instance(this._id(code));
    }

    // Back to the pool of its own object.
    _release(view) {
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

    // The screen, the engine on the renderer of the settings, the HUD.
    _buildDisplay() {
        this._rendererCode = lightLaneSettings.getRenderer();
        this._screen       = new ScreenManager('screen', {fullscreen: true, virtualWidth: LightLanePresentation.VIRTUAL_WIDTH, virtualHeight: LightLanePresentation.VIRTUAL_HEIGHT});
        this._engine       = new Engine3d(this._screen, new Object3dRendererList().getRenderer(this._rendererCode));
        this._engine.setFov(LightLaneTuning.CAMERA_FOV)
            .setZBuffer(LightLaneTuning.Z_NEAR, LightLaneTuning.Z_FAR)
            .setBackground(...LightLaneTuning.BACKGROUND)
            .setLightAmbient([...LightLaneTuning.AMBIENT])
            .setDepthShading({...LightLaneTuning.DEPTH_SHADING})
            .setSky(LightLanePresentation._sky())
            .addLight(this._light);
        this._hud = new LightLaneHud(this._engine, this._simulation).setBest(this._best).setOnPause(this._onPause).setShieldSource(this._shield);
        this._screen.bindHud(this._hud);
        this._rows.forEach((slot) => this._clearSlot(slot));
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
LightLanePresentation.SHARD_PLAYER    = 'Player';
// Rotation about z that leans the runner towards a move to the right (Instance.setRotation's sign).
LightLanePresentation.LEAN_SIGN       = -1;
// The sides of a lane: left, right.
LightLanePresentation.SIDES           = Object.freeze([-1, 1]);
// Sign of Instance.setRotation for an enemy's lean into a move towards +x (Matrix.composeInstanceTransform: +z tilts the
// top towards −x).
LightLanePresentation.ENEMY_LEAN_SIGN = -1;
// Lengths closer than this are equal (a trail's straight run, its band's end).
LightLanePresentation.EPSILON         = 1e-6;
// The sweeps' heights (SWEEP_DRAWN keys).
LightLanePresentation.LOW             = 'low';
// The bloom works with the WebGL renderer only.
LightLanePresentation.BLOOM_RENDERER  = 'webgl';
// A tile's LightLaneModels.LIT_LEVELS variant by its halves' levels [F, M, P][F, M, P]; null: both plain.
LightLanePresentation.LIT_CODES       = Object.freeze(['F', 'M', 'P'].map((a) => Object.freeze(['F', 'M', 'P'].map((b) => (((a + b) === 'PP') ? null : (a + b))))));
