/**
 * The gallery's 3D view (art § 10): an item of the game (its objects, built by LightLaneModels as for a run) turning on
 * itself in a canvas of the gallery screen, framed on its bounding sphere, lit and rendered as in the game. It turns on
 * its own until the player turns it (Left / Right held, the stick, a finger or the mouse dragged across: up and down
 * too, the camera going over or under it), then stays where it was left until the next item; the runner plays its
 * clips in turn (GALLERY_RUNNER_CLIPS), its jump with its rise.
 *
 * The objects are built once and kept between two visits (and their instances reused) until a run resets the loader
 * (unload(), called by the navigator as a run starts).
 */
class LightLaneGalleryView {
    /**
     * @param {HTMLElement} host - the element the canvas fills (it gets the id HOST_ID)
     */
    constructor(host) {
        this._host       = host;
        this._screen     = null;
        this._engine     = null;
        this._width      = 0;
        this._height     = 0;
        this._ready      = false;
        this._running    = false;
        this._item       = null;
        this._parts      = [];       // {instance, x, y, z, yaw}: the item's objects, offsets from its pivot
        this._centreY    = 0;
        this._radius     = 1;
        this._angle      = 0;        // degrees about the vertical
        this._pitch      = LightLaneTuning.GALLERY_PITCH;   // degrees, the camera above it (below: negative)
        this._manual     = false;    // the player turned it: no turn on its own until the next item
        this._turn       = 0;        // −1, 0, +1: Left / Right held
        this._runner     = null;     // the runner's AnimatedInstance, built once
        this._model      = null;
        this._clip       = -1;
        this._clipTime   = 0;
        this._events     = [];
        this._rotation   = [0, 0, 0];
        this._last       = null;
        this._pad        = new AppInputGamepad();
        this._resizeTimer = null;
        // A size that changes on and on (a window dragged): the canvas built again once it rests.
        this._observer   = new ResizeObserver(() => {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => this._resize(), LightLaneGalleryView.RESIZE_DELAY_MS);
        });
        this._frame      = (timestamp) => this._animate(timestamp);
    }

    // The loader reset (a run starts): the objects built for the gallery are gone.
    static unload() {
        LightLaneGalleryView._modelsBuilt = false;
        LightLaneGalleryView._instances.clear();
        LightLaneGalleryView._sharedRunner = null;
    }

    /**
     * The objects loaded (as for a run), then the item shown.
     *
     * @param {string|null} item - one of LightLaneTuning.GALLERY_ITEMS, null for none
     */
    start(item) {
        this._item    = item;
        this._running = true;
        this._host.id = LightLaneGalleryView.HOST_ID;
        if (LightLaneGalleryView._modelsBuilt) {
            this._onModelsReady();
            return this;
        }
        loader.reset();
        LightLaneGalleryView.unload();
        loader.beginBatch();
        LightLaneModels.load(false);
        loader.setCallback(() => {
            loader.clearCallback();
            LightLaneModels.compensate();
            LightLaneGalleryView._modelsBuilt = true;
            this._onModelsReady();
        });
        loader.endBatch();

        return this;
    }

    stop() {
        this._running = false;
        this._ready   = false;
        clearTimeout(this._resizeTimer);
        this._observer.disconnect();
        this._destroyScreen();
    }

    _onModelsReady() {
        if (!this._running) {
            return;
        }
        this._model = loader.animatedModels().getByCode(LightLaneModels.RUNNER);
        if (LightLaneGalleryView._sharedRunner === null) {
            LightLaneGalleryView._sharedRunner = new AnimatedInstance(this._model).bind();
            LightLaneGalleryView._sharedRunner.getInstance().setRenderLight(LightLaneTuning.LIGHT_COMPENSATION);
        }
        this._runner = LightLaneGalleryView._sharedRunner;
        this._ready  = true;
        this._observer.observe(this._host);
        this._resize();
        this.show(this._item);
        requestAnimationFrame(this._frame);
    }

    // An object's instance, one a code, reused from one item (and one visit) to the next.
    static _instance(code) {
        const instances = LightLaneGalleryView._instances;
        if (!instances.has(code)) {
            instances.set(code, LightLanePresentation.instance(LightLaneModels.objectId(code)));
        }

        return instances.get(code);
    }

    /**
     * @param {string|null} item - one of LightLaneTuning.GALLERY_ITEMS, null for none (a locked item: nothing drawn)
     */
    show(item) {
        this._item   = item;
        // Seen from the front (the runner runs towards +z, the bike towards −z).
        this._angle  = ((item === LightLaneGalleryView.RUNNER) ? LightLaneGalleryView.HALF_TURN : 0);
        this._pitch  = LightLaneTuning.GALLERY_PITCH;
        this._manual = false;
        if (!this._ready) {
            return this;
        }
        this._parts.length = 0;
        if (item === null) {
            return this;
        }
        if (item === LightLaneGalleryView.RUNNER) {
            this._centreY = LightLaneGalleryView.RUNNER_CENTRE * LightLaneTuning.RUNNER_HEIGHT;
            this._radius  = LightLaneGalleryView.RUNNER_RADIUS * LightLaneTuning.RUNNER_HEIGHT;
            this._clip    = -1;
            this._nextClip();
            return this;
        }
        for (const [code, x, y, z, yaw] of LightLaneGalleryView._layout(item)) {
            this._parts.push({instance: LightLaneGalleryView._instance(code), x: x, y: y, z: z, yaw: yaw});
        }
        // A gap is its hole (in the middle of its tile, at the top's height): framed on it, the tile running out of the view.
        if (item === LightLaneGalleryView.GAP_ITEM) {
            this._centreY = 0;
            this._radius  = LightLaneGalleryView.GAP_RADIUS;
            return this;
        }
        this._frameParts();

        return this;
    }

    /**
     * @param {int} direction - −1 Left held, +1 Right held, 0 none
     */
    setTurn(direction) {
        this._turn = direction;

        return this;
    }

    /**
     * @param {number} dx - a finger's move across the view, pixels: the item turns
     * @param {number} dy - its move down, pixels: the camera goes up over it (short of straight above or below)
     */
    swipe(dx, dy) {
        const limit  = LightLaneTuning.GALLERY_PITCH_MAX;
        this._manual = true;
        // The item follows the finger: a move to the right brings its near side to the right (user request).
        this._angle -= (dx * LightLaneTuning.GALLERY_TURN_SWIPE);
        this._pitch  = Math.max(-limit, Math.min(limit, (this._pitch + (dy * LightLaneTuning.GALLERY_TURN_SWIPE))));

        return this;
    }

    // [code, x, y, z, yaw] of each object of an item, in the frame of the game (a bike runs towards −z, its trail behind).
    static _layout(item) {
        switch (item) {
            case 'hurdle':
                return [[LightLaneModels.HURDLE, 0, 0, 0, 0]];
            case 'gate':
                return [[LightLaneModels.GATE, 0, 0, 0, 0]];
            case 'block':
                return [[LightLaneModels.blockCode(LightLaneGalleryView.BLOCK) + LightLaneModels.BLOCK_SIDES[1][0], 0, 0, 0, 0]];
            case 'gap': {
                const y     = -LightLaneTuning.TILE_THICKNESS;
                // The lane's edge lines on both sides (user request): its tile's own on the left, the right edge cut at the hole.
                const parts = [[LightLaneModels.gapTileCode(LightLaneGalleryView.GAP), 0, y, 0, 0], [LightLaneModels.tileEdgeCode(LightLaneGalleryView.GAP), 0, y, 0, 0]];
                for (const side of LightLanePresentation.SIDES) {
                    for (const wall of LightLaneModels.holeWalls(LightLaneGalleryView.GAP, side, LightLaneModels.TILE)) {
                        parts.push([wall, (side * LightLaneTuning.LANE_WIDTH / 2), y, 0, 0]);
                    }
                }
                return parts;
            }
            case 'bike':
                return [[LightLaneModels.PROWLER, 0, 0, 0, 0]];
            case 'bikeTrail': {
                // The bike's box from its front; its trail from its back: a long piece of the first band, then the tail.
                const length = LightLaneTuning.OBSTACLES.R.length;
                const long   = LightLaneTuning.TRAIL_PIECE_LONG;
                return [
                    [LightLaneModels.PROWLER, 0, 0, 0, 0],
                    [LightLaneModels.trailCode(0, long), 0, 0, ((length / 2) + (long / 2)), 0],
                    [LightLaneModels.TRAIL_TAIL, 0, 0, ((length / 2) + long + (LightLaneTuning.TRAIL_TAIL / 2)), 0]
                ];
            }
            case 'sentinel':
                return [[LightLaneModels.SENTINEL, 0, 0, 0, 0]];
            default:
                return [];
        }
    }

    // The item's bounding sphere (its objects' spheres together): its centre the pivot of the turn, its radius the
    // camera's distance.
    _frameParts() {
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        for (const part of this._parts) {
            const object = part.instance.getObject();
            const centre = object.getCenter();
            const radius = object.getBoundingRadius();
            const at     = [(part.x + centre[0]), (part.y + centre[1]), (part.z + centre[2])];
            for (let k = 0; k < 3; k++) {
                min[k] = Math.min(min[k], (at[k] - radius));
                max[k] = Math.max(max[k], (at[k] + radius));
            }
        }
        const pivot = [((min[0] + max[0]) / 2), ((min[1] + max[1]) / 2), ((min[2] + max[2]) / 2)];
        let radius  = 0;
        for (const part of this._parts) {
            const object = part.instance.getObject();
            const centre = object.getCenter();
            const dx     = ((part.x + centre[0]) - pivot[0]);
            const dy     = ((part.y + centre[1]) - pivot[1]);
            const dz     = ((part.z + centre[2]) - pivot[2]);
            radius = Math.max(radius, (Math.sqrt((dx * dx) + (dy * dy) + (dz * dz)) + object.getBoundingRadius()));
            part.x -= pivot[0];
            part.z -= pivot[2];
        }
        this._centreY = pivot[1];
        this._radius  = radius;
    }

    _animate(timestamp) {
        if (!this._running) {
            return;
        }
        const dt = ((this._last === null) ? 0 : Math.min(LightLaneGalleryView.MAX_STEP, ((timestamp - this._last) / LightLaneTuning.MS_PER_SECOND)));
        this._last = timestamp;
        const turn = this._readTurn();
        if (turn !== 0) {
            this._manual = true;
            this._angle += (turn * LightLaneTuning.GALLERY_TURN_SPEED * dt);
        } else if (!this._manual) {
            this._angle += ((LightLaneGalleryView.FULL_TURN / LightLaneTuning.GALLERY_TURN_PERIOD) * dt);
        }
        this._angle %= LightLaneGalleryView.FULL_TURN;
        if (this._engine !== null) {
            this._draw(dt);
        }
        requestAnimationFrame(this._frame);
    }

    // Left / Right held, or the gamepad's d-pad or stick.
    _readTurn() {
        if (this._turn !== 0) {
            return this._turn;
        }
        if (!this._pad.isAvailable()) {
            return 0;
        }
        const stick = this._pad.readMenuStickX();
        if (this._pad.readDpadLeft() || (stick < -LightLaneGalleryView.STICK)) {
            return -1;
        }

        return ((this._pad.readDpadRight() || (stick > LightLaneGalleryView.STICK)) ? 1 : 0);
    }

    _draw(dt) {
        const engine   = this._engine;
        const pitch    = this._pitch;
        const tanX     = Math.tan(LightLaneTuning.CAMERA_FOV * Math.PI / LightLaneGalleryView.HALF_TURN);
        const tanY     = (tanX * this._height / this._width);
        const distance = (this._radius * LightLaneTuning.GALLERY_MARGIN / Math.min(tanX, tanY));
        const down     = (pitch * Math.PI / LightLaneGalleryView.HALF_TURN);
        engine.setBloom((lightLaneSettings.isBloomOn() && (lightLaneSettings.getRenderer() === LightLanePresentation.BLOOM_RENDERER)) ? LightLaneGalleryView.BLOOM : null);
        engine.drawInit();
        engine.matrixIdentity();
        engine.matrixRotateX(-pitch);
        engine.matrixTranslate(0, -(this._centreY + (distance * Math.sin(down))), (distance * Math.cos(down)));
        engine.lightsCalculatePosition();
        const radians = (this._angle * Math.PI / LightLaneGalleryView.HALF_TURN);
        const c       = Math.cos(radians);
        const s       = Math.sin(radians);
        if (this._item === LightLaneGalleryView.RUNNER) {
            this._drawRunner(dt);
        }
        for (const part of this._parts) {
            this._rotation[1] = (part.yaw + this._angle);
            part.instance.setRotation(this._rotation);
            // Matrix.composeInstanceTransform: a +y turn takes −z towards −x.
            part.instance.placeAt(((part.x * c) + (part.z * s)), part.y, ((part.z * c) - (part.x * s)));
            engine.drawInstance(part.instance);
        }
        engine.drawFinish();
    }

    // Its clips in turn; its jump rises as in a run (a parabola of JUMP_HEIGHT over the clip's time).
    _drawRunner(dt) {
        const clips = LightLaneTuning.GALLERY_RUNNER_CLIPS;
        this._clipTime += dt;
        if (this._clipTime >= clips[this._clip][1]) {
            this._nextClip();
        }
        const [name, time] = clips[this._clip];
        const t      = Math.min(1, (this._clipTime / time));
        const y      = ((name === LightLanePresentation.CLIP_JUMP) ? (4 * LightLaneTuning.JUMP_HEIGHT * t * (1 - t)) : 0);
        this._rotation[1] = this._angle;
        this._runner.place([0, y, 0], this._rotation);
        this._events.length = 0;
        this._runner.update(dt, this._events);
        this._engine.drawInstance(this._runner.getInstance());
    }

    _nextClip() {
        const clips = LightLaneTuning.GALLERY_RUNNER_CLIPS;
        this._clip     = ((this._clip + 1) % clips.length);
        this._clipTime = 0;
        const name     = clips[this._clip][0];
        const clip     = this._model.getClip(name);
        const options  = {loop: (name === LightLanePresentation.CLIP_RUN), speed: 1};
        if (this._clip === 0) {
            this._runner.getPlayer().play(clip, options);
            return;
        }
        this._runner.getPlayer().crossFadeTo(clip, LightLaneTuning.FADE_SHORT_CLIP, options);
    }

    // A canvas of the host's size, built again when it changes (ScreenManager sizes a canvas only at its creation).
    _resize() {
        const width  = Math.floor(this._host.clientWidth);
        const height = Math.floor(this._host.clientHeight);
        if ((width === 0) || (height === 0) || ((width === this._width) && (height === this._height) && (this._engine !== null))) {
            return;
        }
        this._destroyScreen();
        this._width  = width;
        this._height = height;
        this._screen = new ScreenManager(LightLaneGalleryView.HOST_ID, {width: width, height: height});
        this._engine = new Engine3d(this._screen, new Object3dRendererList().getRenderer(lightLaneSettings.getRenderer()));
        this._engine.setFov(LightLaneTuning.CAMERA_FOV)
            .setZBuffer(LightLaneTuning.Z_NEAR, LightLaneTuning.Z_FAR)
            .setBackground(...LightLaneTuning.BACKGROUND)
            .setLightAmbient([...LightLaneTuning.AMBIENT]);
    }

    _destroyScreen() {
        if (this._screen !== null) {
            this._screen.destroyContainer();
            this._screen = null;
            this._engine = null;
        }
    }
}

LightLaneGalleryView.HOST_ID       = 'lightLaneGalleryView';
// The objects built in the loader for the gallery (kept between visits until a run resets it), their instances by code
// and the runner's.
LightLaneGalleryView._modelsBuilt  = false;
LightLaneGalleryView._instances    = new Map();
LightLaneGalleryView._sharedRunner = null;
// A size change waits this long for the next before the canvas is built again, ms.
LightLaneGalleryView.RESIZE_DELAY_MS = 200;
LightLaneGalleryView.RUNNER        = 'runner';
// The block and the gap shown (a mid length).
LightLaneGalleryView.BLOCK         = 'B6';
LightLaneGalleryView.GAP           = 'X3';
LightLaneGalleryView.GAP_ITEM      = 'gap';
// The gap's framing, metres: its hole and the walls beside it.
LightLaneGalleryView.GAP_RADIUS    = 2;
// The runner framed by its height: its centre this share up, its sphere this share of it (room for its jump).
LightLaneGalleryView.RUNNER_CENTRE = 0.75;
LightLaneGalleryView.RUNNER_RADIUS = 0.8;
// The gamepad's stick turns past this.
LightLaneGalleryView.STICK         = 0.5;
// A frame's time at most, s (a tab back from the background).
LightLaneGalleryView.MAX_STEP      = 0.1;
LightLaneGalleryView.HALF_TURN     = 180;
LightLaneGalleryView.FULL_TURN     = 360;
// The game's bloom (LightLanePresentation).
LightLaneGalleryView.BLOOM         = Object.freeze({glowDepthShading: LightLaneTuning.BLOOM_GLOW_DEPTH_SHADING, glowFar: LightLaneTuning.BLOOM_GLOW_FAR,
    glowFarMax: LightLaneTuning.BLOOM_GLOW_FAR_MAX});
