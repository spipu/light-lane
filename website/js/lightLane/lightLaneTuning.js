/**
 * Every tuning value of the game (gameplay, art § 2, § 3, § 4, § 8), one place: the code never writes a number of
 * the design inline. Lengths in metres, times in seconds, speeds in m/s, angles in degrees. Grouped as the specs are;
 * each step of the plan adds its own group.
 */
class LightLaneTuning {
}

// --- Time (gameplay § 1) ---
LightLaneTuning.STEP_SECONDS  = (1 / 120);
LightLaneTuning.MS_PER_SECOND = 1000;

// --- Lanes and tiles (gameplay § 2, art § 5.2) ---
LightLaneTuning.LANE_WIDTH     = 2.0;
LightLaneTuning.LANES_3        = [-1, 0, 1];
LightLaneTuning.LANES_5        = [-2, -1, 0, 1, 2];
LightLaneTuning.TILE_LENGTH    = 10.0;
LightLaneTuning.TILE_THICKNESS = 0.3;
// The tiles' tops and walls are a little see-through, the fog showing under them (user request); lines and marks stay opaque.
LightLaneTuning.TILE_ALPHA = 0.8;
// Cross marks on every tile, every TILE_MARK_STEP from its start: they show the run's speed (user request); painted
// FLOOR_MARK, no glow.
LightLaneTuning.TILE_MARK_STEP  = 5.0;
LightLaneTuning.TILE_MARK_WIDTH = 0.10;
// The track is drawn this far behind and ahead of the runner (far plane, art § 2).
LightLaneTuning.TRACK_BEHIND = 10;
LightLaneTuning.TRACK_AHEAD  = 140;

// --- Difficulty (gameplay § 9.1): start distance (m) and target speed (m/s) of each tier ---
// Tiers 0 and 1 run at the speed the start's rise ends at; tiers 2 to 7 climb evenly from there to 21.5 m/s (user decision).
LightLaneTuning.TIERS = [
    {from: 0,    speed: 15.0},
    {from: 300,  speed: 15.0},
    {from: 700,  speed: 16.1},
    {from: 1200, speed: 17.2},
    {from: 1800, speed: 18.3},
    {from: 2500, speed: 19.4},
    {from: 3300, speed: 20.5},
    {from: 4200, speed: 21.5},
];
// The start of a run (user decision): from START_SPEED_FROM to START_SPEED_TO over the first START_LENGTH metres, quick at
// first then levelling off (LightLaneDifficulty.startSpeed); no tier ramp meanwhile.
LightLaneTuning.START_SPEED_FROM = 10.0;
LightLaneTuning.START_SPEED_TO   = 15.0;
LightLaneTuning.START_LENGTH     = 500;
// Tiers 8 to TIER_LAST: one every TIER_LATE_LENGTH metres after tier 7, TIER_LATE_SPEED_STEP faster, up to SPEED_MAX
// (user decision: 35 m/s, reached at tier 21, 18 200 m, about 13 min of running).
LightLaneTuning.TIER_LATE_LENGTH     = 1000;
LightLaneTuning.TIER_LATE_SPEED_STEP = 1.0;
LightLaneTuning.TIER_LAST            = 21;
LightLaneTuning.SPEED_MAX            = 35.0;
// On entering a tier, the speed reaches its target linearly in this time.
LightLaneTuning.TIER_RAMP_SECONDS = 6.0;

// --- Countdown (gameplay § 8.1) ---
LightLaneTuning.COUNTDOWN_DIGITS     = [3, 2, 1];
LightLaneTuning.COUNTDOWN_DIGIT_TIME = 0.6;
LightLaneTuning.COUNTDOWN_GO_TIME    = 0.4;

// --- Runner animation (art § 6.2) ---
// A lane change leans the whole runner (pivot at the feet) towards its move while the run clip goes on (user request:
// a lane clip broke the stride); reached and left in RUNNER_LEAN_TIME.
LightLaneTuning.RUNNER_LEAN      = 12;
LightLaneTuning.RUNNER_LEAN_TIME = 0.06;
LightLaneTuning.FADE_SHORT_CLIP  = 0.12;
// With the jump boots, the jump clip is played slower to last the longer jump (jumpHigh, art § 6.2).
LightLaneTuning.JUMP_HIGH_PACE   = 0.79;
// Playback speed of run: min(RUN_PACE_BASE + (v − RUN_PACE_FROM) / RUN_PACE_SPAN × RUN_PACE_GAIN, RUN_PACE_MAX).
LightLaneTuning.RUN_PACE_BASE = 1.0;
LightLaneTuning.RUN_PACE_FROM = 10;
LightLaneTuning.RUN_PACE_SPAN = 15;
LightLaneTuning.RUN_PACE_GAIN = 0.8;
LightLaneTuning.RUN_PACE_MAX  = 1.8;

// --- Camera (art § 8) ---
LightLaneTuning.CAMERA_HEIGHT_BASE = 3.0;
LightLaneTuning.CAMERA_HEIGHT_FEET = 0.35;
LightLaneTuning.CAMERA_ABOVE_FEET  = 2.2;
LightLaneTuning.CAMERA_FOLLOW_RATE = 12;
LightLaneTuning.CAMERA_BACK        = 5.2;
LightLaneTuning.CAMERA_PITCH       = -14;
LightLaneTuning.CAMERA_ROLL        = 1.5;
LightLaneTuning.CAMERA_ROLL_TIME   = 0.2;
LightLaneTuning.CAMERA_FOV         = 36;

// --- Scene (art § 2) ---
// A light at the runner's centre (user request, 2026-11-13; kept for good), range RUNNER_LIGHT_RANGE × its half
// height. A light never makes a face brighter than its painted colour (Object3dRendererBase._pointColor clamps
// ambient + lights to 255): the ambient is down to AMBIENT and the tiles' tops are cut in cells of TILE_TOP_CELL near
// the runner (the light is computed at the vertices).
// A light (120, 200, 220) made 1.875 times stronger (user requests); a component over 255 is fine: only ambient + lights
// is clamped, so a stronger light mostly widens the part brought to the full painted colour.
LightLaneTuning.RUNNER_LIGHT_COLOR = [225, 375, 412];
LightLaneTuning.RUNNER_LIGHT_RANGE = 2.0;
// The ambient is a third: the floor is painted LIGHT_COMPENSATION times lighter (the same away from the light, up to
// that many times lighter in it) and every other face keeps its look through its light group's factor
// (LightLaneModels.LIGHT_GROUP) or its instance's render light.
LightLaneTuning.AMBIENT = [85, 85, 85];
// At a death (user request), the runner's light flares to DEATH_LIGHT_PEAK times its colour and DEATH_LIGHT_RANGE times
// its range in DEATH_LIGHT_RISE, then dies down to nothing by the end of the dying (DYING_TIME).
LightLaneTuning.DEATH_LIGHT_PEAK   = 3;
LightLaneTuning.DEATH_LIGHT_RANGE  = 1.5;
LightLaneTuning.DEATH_LIGHT_RISE   = 0.12;
LightLaneTuning.LIGHT_COMPENSATION = (255 / LightLaneTuning.AMBIENT[0]);
LightLaneTuning.TILE_TOP_CELL      = 0.5;
// The half tile right after the lit ones: its top in cells of TILE_MID_CELL (user request: an intermediate
// level of detail before the finest).
LightLaneTuning.TILE_MID_CELL = 1.0;
// The camera sees the ground this far behind the runner (art § 8): the fine cells start there.
LightLaneTuning.GROUND_SEEN_BEHIND = 1.1;
// The fine cells reach this far past the light's range, so a half tile is fine before the light comes onto it (user
// request: the switch came too close to the runner).
LightLaneTuning.FINE_AHEAD_MARGIN = 3.0;
// The test mode's `lod`: the tiles' tops coloured by level: fine cells red, coarser cells green, every other top blue.
LightLaneTuning.LOD_COLORS = Object.freeze({fine: [90, 22, 22], mid: [22, 80, 26], plain: [22, 30, 90]});
LightLaneTuning.BACKGROUND = [10, 20, 24];
LightLaneTuning.Z_NEAR     = 0.2;
LightLaneTuning.Z_FAR      = 140;
// The bloom's halo keeps none of the depth shading (user request: the halo grows with the depth, the lines keep their
// size): a distant line keeps its whole halo (RendererWebglBloom glowDepthShading).
LightLaneTuning.BLOOM_GLOW_DEPTH_SHADING = 0;
// From half the track's reach on (user request), the halo keeps its size on screen: the glow grows with the depth past
// BLOOM_GLOW_FAR, up to BLOOM_GLOW_FAR_MAX times at the track's end (RendererWebglBloom glowFar / glowFarMax).
LightLaneTuning.BLOOM_GLOW_FAR     = (LightLaneTuning.CAMERA_BACK + (LightLaneTuning.TRACK_AHEAD / 2));
LightLaneTuning.BLOOM_GLOW_FAR_MAX = ((LightLaneTuning.CAMERA_BACK + LightLaneTuning.TRACK_AHEAD) / LightLaneTuning.BLOOM_GLOW_FAR);
LightLaneTuning.DEPTH_SHADING      = Object.freeze({visibility: 50.7, visibilityMax: 10, shadeBase: 1.268, shadeScale: 0, rampCount: 32, strength: 1});

// --- Palette (art § 3), 0-255 ---
LightLaneTuning.COLOR = Object.freeze({
    BG:             [10, 20, 24],
    FLOOR_TOP:      [14, 26, 32],
    // The cross marks of the tiles: painted, not lit (user request: discreet, no neon).
    FLOOR_MARK:     [24, 42, 50],
    BODY_TOP:       [26, 34, 40],
    BODY_SIDE:      [16, 22, 28],
    BODY_BOTTOM:    [8, 11, 14],
    LINE_DIM:       [40, 96, 110],
    PLAYER:         [226, 246, 250],
    PLAYER_FRAGILE: [206, 123, 66],
    COIN:           [240, 252, 255],
    AID:            [120, 214, 232],
    WARN:           [216, 160, 75],
    DANGER:         [206, 123, 66],
    LETHAL:         [199, 76, 53],
    // The enemies' shell, a muted orange to be seen better on the dark track (user requests): top, flanks, bottom.
    ENEMY_TOP:      [150, 88, 50],
    ENEMY_SIDE:     [118, 68, 38],
    ENEMY_BOTTOM:   [64, 38, 22],
});

// --- Lines (art § 4) ---
LightLaneTuning.LINE_SIZE       = 0.08;
LightLaneTuning.LINE_SIZE_DECOR = 0.05;
LightLaneTuning.LINE_OUTSET     = 0.01;
// Marks laid on the floor (the warning zone's chevrons) stand this far above the tiles' top (art § 4).
LightLaneTuning.FLOOR_LIFT      = 0.02;
// Marks laid on the floor are drawn over it (Instance.setRenderDepthBias, art § 4).
LightLaneTuning.FLOOR_DEPTH_BIAS = 0.05;
// The warning zone's chevron (art § 5.2 arrow), [across, along], m.
LightLaneTuning.ARROW_SIZE      = Object.freeze([1.2, 0.8]);
// --- Fog under the track: the user's 60 frames (.source/fog/buildFog.py → assets/lightLane/textures/fog/) ---
// A plane FOG_DEPTH under the track, from FOG_BEHIND behind the runner to FOG_AHEAD ahead, FOG_HALF_WIDTH aside, its
// texture repeated every FOG_TILE ([across, along] metres) and played at FOG_FPS (user request); the plane steps by
// whole tiles, so the fog stays put in the world and flows under the runner.
LightLaneTuning.FOG_FRAMES     = 60;
LightLaneTuning.FOG_FPS        = 30;
LightLaneTuning.FOG_DEPTH      = 6;
LightLaneTuning.FOG_BEHIND     = 20;
LightLaneTuning.FOG_AHEAD      = 160;
LightLaneTuning.FOG_HALF_WIDTH = 220;
LightLaneTuning.FOG_TILE       = Object.freeze([60, 30]);
// The fog's texture darkened to 60 % (user requests).
LightLaneTuning.FOG_COLOR = Object.freeze([153, 153, 153]);

// --- Background: the user's picture of a city (.source/fond.png → assets/lightLane/textures/skyline.jpg) ---
// Drawn by the engine's sky pass (Engine3d.setSky: before the geometry, by view angle, no depth shading). Its own
// proportions (user request: not squashed): SKY_SPAN degrees across its width, as many a pixel upwards; the luminous
// base of its central building (SKY_HORIZON_ROW) exactly on the track's far end, kept there (user requests): that end
// lies SKY_DISTANCE = TRACK_AHEAD + CAMERA_BACK ahead of the camera, so it is seen atan(camera y / SKY_DISTANCE) under
// the horizon and atan(−camera x / SKY_DISTANCE) aside; the picture follows both every frame (the lane, the jump) and
// leans with the camera's roll.
LightLaneTuning.SKY_URL         = 'textures/skyline.jpg';
LightLaneTuning.SKY_WIDTH_PX    = 2172;
LightLaneTuning.SKY_HEIGHT_PX   = 724;
LightLaneTuning.SKY_HORIZON_ROW = 636;
LightLaneTuning.SKY_SPAN        = 74;
LightLaneTuning.SKY_DISTANCE    = (LightLaneTuning.TRACK_AHEAD + LightLaneTuning.CAMERA_BACK);

// --- Commands (gameplay § 10) ---
// Gamepad stick: the dominant axis past STICK_TRIGGER makes an order; re-armed once both axes are under STICK_REARM.
LightLaneTuning.STICK_TRIGGER = 0.6;
LightLaneTuning.STICK_REARM   = 0.3;

// --- Runner (gameplay § 3) ---
LightLaneTuning.RUNNER_HALF_WIDTH   = 0.30;
LightLaneTuning.RUNNER_HALF_DEPTH   = 0.25;
LightLaneTuning.RUNNER_HEIGHT       = 1.75;
LightLaneTuning.RUNNER_SLIDE_HEIGHT = 0.80;
LightLaneTuning.LANE_CHANGE_TIME    = 0.16;
LightLaneTuning.JUMP_HEIGHT         = 1.40;
LightLaneTuning.JUMP_TIME           = 0.75;
LightLaneTuning.JUMP_HEIGHT_BOOTS   = 2.40;
LightLaneTuning.JUMP_TIME_BOOTS     = 0.95;
LightLaneTuning.FAST_DROP_SPEED     = 18;
LightLaneTuning.SLIDE_TIME          = 0.70;
LightLaneTuning.ORDER_KEEP_TIME     = 0.20;
LightLaneTuning.STUMBLE_SLOW        = 0.85;
LightLaneTuning.STUMBLE_SLOW_TIME   = 1.0;
LightLaneTuning.STUMBLE_RAMP_TIME   = 0.5;
LightLaneTuning.FRAGILE_TIME        = 5.0;
LightLaneTuning.STUMBLE_SHAKE       = Object.freeze({amplitude: 0.08, time: 0.25});
// Past the track's edge (an outer lane that ended), feet at or under this height: the runner falls (as in a gap's box).
LightLaneTuning.VOID_FEET           = 0.05;

// --- Fixed obstacles (gameplay § 4): collision box across (±x), height (y0..y1), depth from the front face
// (z0..z1; a negative z1 counts from the element's length: L − |z1|), drawn depth. ---
LightLaneTuning.OBSTACLES = Object.freeze({
    H:   {kind: 'hurdle', halfWidth: 0.75, y0: 0, y1: 0.80, z0: 0.05, z1: 0.25, length: 0.30},
    P:   {kind: 'gate', halfWidth: 0.85, y0: 1.15, y1: 1.40, z0: 0.05, z1: 0.25, length: 0.30},
    B3:  {kind: 'block', halfWidth: 0.80, y0: 0, y1: 3.10, z0: 0.05, z1: -0.05, length: 3},
    B6:  {kind: 'block', halfWidth: 0.80, y0: 0, y1: 3.10, z0: 0.05, z1: -0.05, length: 6},
    B10: {kind: 'block', halfWidth: 0.80, y0: 0, y1: 3.10, z0: 0.05, z1: -0.05, length: 10},
    B16: {kind: 'block', halfWidth: 0.80, y0: 0, y1: 3.10, z0: 0.05, z1: -0.05, length: 16},
    X3:  {kind: 'gap', halfWidth: 0.70, y0: 0, y1: 0.05, z0: 0.30, z1: -0.30, length: 3.0, holeFrom: 3.5},
    X5:  {kind: 'gap', halfWidth: 0.70, y0: 0, y1: 0.05, z0: 0.30, z1: -0.30, length: 4.5, holeFrom: 3.0},
    // Enemies (gameplay § 6): two-wheelers of a real motorbike's size (user decision), their box from their moving front;
    // laid by their meeting point (generation § 5).
    'R':  {kind: 'prowler', halfWidth: 0.40, y0: 0.05, y1: 1.30, z0: 0.10, z1: 3.10, length: 3.2},
    'T<': {kind: 'stalker', halfWidth: 0.40, y0: 0.05, y1: 1.30, z0: 0.10, z1: 3.10, length: 3.2, side: -1},
    'T>': {kind: 'stalker', halfWidth: 0.40, y0: 0.05, y1: 1.30, z0: 0.10, z1: 3.10, length: 3.2, side: 1},
});
// --- Enemies (gameplay § 6, generation § 5) ---
// A bike runs to the runner at ENEMY_SPEED on the ground whatever the tier (user decision): its share of the runner's
// speed is ENEMY_SPEED / the target speed of its meeting (the test mode's fixed speed, if any), its front at
// zm + share × (zm − zRunner), so it reaches its meeting point zm exactly when the runner does.
LightLaneTuning.ENEMY_SPEED        = 10;
// Drawn (activated) within ENEMY_SHOWN ahead of the runner.
LightLaneTuning.ENEMY_SHOWN        = 135;
// A stalker (τ = time to the meeting point): announced from STALKER_WARN, moves across from STALKER_MOVE over
// STALKER_MOVE_TIME (S-curve), then stays on its new lane.
LightLaneTuning.STALKER_WARN       = 2.4;
LightLaneTuning.STALKER_MOVE       = 1.6;
LightLaneTuning.STALKER_MOVE_TIME  = 0.5;
// From TRAIL_TIER (4 200 m, user decision), a bike leaves a light trail behind its back: TRAIL_LENGTH long (3 tiles) in
// TRAIL_BANDS bands each dimmer than the one before (TRAIL_FADE of the colour), TRAIL_THICK thick (a quarter of the
// tyre) and TRAIL_HEIGHT high (the tyre's); it follows the bike's path, kills at a touch, a jump clears it.
LightLaneTuning.TRAIL_TIER   = 7;
LightLaneTuning.TRAIL_LENGTH = 30;
LightLaneTuning.TRAIL_BANDS  = 3;
LightLaneTuning.TRAIL_FADE   = Object.freeze([1.0, 0.6, 0.3]);
LightLaneTuning.TRAIL_THICK  = 0.085;
LightLaneTuning.TRAIL_HEIGHT = 1.2;
// Its drawn pieces: straight runs in TRAIL_PIECE_LONG pieces, the curve of a lane change in TRAIL_PIECE_SHORT ones.
LightLaneTuning.TRAIL_PIECE_LONG  = 5;
LightLaneTuning.TRAIL_PIECE_SHORT = 1;
// Its last TRAIL_TAIL metres hold its end, rounded like the bike's wheel (user request), in the last band's light: drawn in
// TRAIL_TAIL_SLICES slices (one piece in a straight run, slice by slice along a curve).
LightLaneTuning.TRAIL_TAIL        = 5;
LightLaneTuning.TRAIL_TAIL_SLICES = 10;
// While it moves across, a stalker only leans into its move (user request: no turn of its heading): ENEMY_LEAN degrees of
// lean a degree of the angle of its path (its sideways speed against its own speed ahead), ENEMY_LEAN_MAX at most.
LightLaneTuning.ENEMY_LEAN         = 1.2;
LightLaneTuning.ENEMY_LEAN_MAX     = 30;
// Its floor arrow on the lane it goes to, STALKER_ARROW_AHEAD before it ([across, along] STALKER_ARROW_SIZE).
LightLaneTuning.STALKER_ARROW_AHEAD = 6;
LightLaneTuning.STALKER_ARROW_SIZE  = Object.freeze([2.4, 1.6]);
// The lanes an enemy reserves around its meeting point (nothing else on them), and the cells it blocks in the
// fairness check (generation § 5, § 8.1).
LightLaneTuning.ENEMY_RESERVE      = Object.freeze([-5, 50]);
LightLaneTuning.ENEMY_BLOCKS       = Object.freeze([-2, 6]);
// Drawn shape of the two-wheelers (art § 5.2, user decision: the language of a light cycle, an original design), origin
// at the centre of its bottom, front towards −z. Wheels without hub: centres at `wheelZ`, `radius`, a tyre `tyre` thick
// (±halfThick across), `segments` around. The shell: stations along z [z, centre y, half width, half height], each a
// rounded section of `section` points; a head light `light` [width, height] at its nose; 3 chevrons `chevron`
// [width, depth] on a stalker's tail.
LightLaneTuning.ENEMY_SHAPE = Object.freeze({
    wheelZ:    Object.freeze([-1.0, 1.0]),
    radius:    0.60,
    tyre:      0.12,
    halfThick: 0.17,
    segments:  12,
    stations:  Object.freeze([
        Object.freeze([-1.60, 0.75, 0.10, 0.10]),
        Object.freeze([-1.20, 0.85, 0.38, 0.30]),
        Object.freeze([-0.50, 0.95, 0.30, 0.35]),
        Object.freeze([0.30, 1.05, 0.28, 0.35]),
        Object.freeze([1.00, 0.90, 0.40, 0.35]),
        Object.freeze([1.60, 0.80, 0.15, 0.15]),
    ]),
    section:   8,
    light:     Object.freeze([0.16, 0.08]),
    chevron:   Object.freeze([0.36, 0.16]),
    chevrons:  3,
});

// --- The Sentinel (gameplay § 7, generation § 7.2) ---
// First pass SENTINEL_FIRST_AFTER into tier SENTINEL_TIER, then every SENTINEL_EVERY [min, max] metres.
LightLaneTuning.SENTINEL_TIER        = 6;
LightLaneTuning.SENTINEL_FIRST_AFTER = 150;
LightLaneTuning.SENTINEL_EVERY       = Object.freeze([900, 1400]);
// Its pass: ARRIVE from behind and above (SENTINEL_FROM [y, z behind the runner]) to SENTINEL_AT [y, z ahead]; PRESENT,
// bobbing SENTINEL_BOB m at SENTINEL_BOB_HZ, following the runner's lane at rate SENTINEL_FOLLOW; LEAVE ahead and up by
// SENTINEL_LEAVE [y, z].
LightLaneTuning.SENTINEL_ARRIVE      = 2.0;
LightLaneTuning.SENTINEL_PRESENT     = 8.0;
LightLaneTuning.SENTINEL_LEAVE_TIME  = 1.5;
LightLaneTuning.SENTINEL_FROM        = Object.freeze([12, -6]);
LightLaneTuning.SENTINEL_AT          = Object.freeze([4.0, 34]);
LightLaneTuning.SENTINEL_LEAVE       = Object.freeze([10, 60]);
LightLaneTuning.SENTINEL_BOB         = 0.2;
LightLaneTuning.SENTINEL_BOB_HZ      = 0.5;
LightLaneTuning.SENTINEL_FOLLOW      = 1.6;
// Its arrival's S-curve swings SENTINEL_SWAY across.
LightLaneTuning.SENTINEL_SWAY        = 2.0;
// The track is bridled from its arrival for SENTINEL_BRIDLE × the target speed: these patterns only, gaps × SENTINEL_GAP.
LightLaneTuning.SENTINEL_BRIDLE      = 11.5;
LightLaneTuning.SENTINEL_GAP         = 1.4;
LightLaneTuning.SENTINEL_PATTERNS    = Object.freeze(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'D1', 'D2', 'D3', 'D4', 'D5']);
// Three attacks a pass, at these times of its presence; strike STRIKE_CHANCE, else a sweep, low or high (never the same
// height twice in a row).
LightLaneTuning.SENTINEL_ATTACKS     = Object.freeze([1.0, 3.4, 5.6]);
LightLaneTuning.STRIKE_CHANCE        = 0.5;
LightLaneTuning.SWEEP_LOW_CHANCE     = 0.5;
// Strike (§ 7.2): announced STRIKE_WARN (a red mark on the lane from STRIKE_MARK [behind, ahead] of the runner, its width
// in STRIKE_WIDTHS steps, blinking at STRIKE_BLINK_HZ over the last STRIKE_BLINK s), then a column STRIKE_TIME long:
// deadly within ±STRIKE_HALF_WIDTH of the lane's centre; its trace dies in STRIKE_TRACE.
LightLaneTuning.STRIKE_WARN          = 1.1;
LightLaneTuning.STRIKE_MARK          = Object.freeze([2, 20]);
LightLaneTuning.STRIKE_WIDTHS        = Object.freeze([0.1, 0.4, 0.8, 1.2, 1.6]);
LightLaneTuning.STRIKE_BLINK         = 0.4;
LightLaneTuning.STRIKE_BLINK_HZ      = 6;
LightLaneTuning.STRIKE_TIME          = 0.25;
LightLaneTuning.STRIKE_HALF_WIDTH    = 0.70;
LightLaneTuning.STRIKE_TRACE         = 1.0;
LightLaneTuning.STRIKE_FLASH         = 0.35;
LightLaneTuning.STRIKE_BEAM          = Object.freeze([1.6, 6.0, 22]);
// The mark's and the ray's see-through (art § 5.2).
LightLaneTuning.STRIKE_MARK_ALPHA    = 0.6;
LightLaneTuning.SWEEP_ALPHA          = 0.5;
// Sweep (§ 7.3): a frame SWEEP_AHEAD of the runner for SWEEP_WARN (blinking at SWEEP_BLINK_HZ), then a ray coming at
// SWEEP_SPEED relative, gone SWEEP_PAST behind the runner; its box [y0, y1] low or high, SWEEP_DEPTH thick; drawn
// [y0, y1] by SWEEP_DRAWN, SWEEP_THICK thick, SWEEP_WIDTH [3 lanes, 5 lanes] wide.
LightLaneTuning.SWEEP_AHEAD          = 26;
LightLaneTuning.SWEEP_WARN           = 0.9;
LightLaneTuning.SWEEP_BLINK_HZ       = 4;
LightLaneTuning.SWEEP_SPEED          = 22;
LightLaneTuning.SWEEP_PAST           = 2;
LightLaneTuning.SWEEP_BOX            = Object.freeze({low: Object.freeze([0.20, 0.60]), high: Object.freeze([1.15, 1.45])});
LightLaneTuning.SWEEP_DRAWN          = Object.freeze({low: Object.freeze([0.15, 0.65]), high: Object.freeze([1.10, 1.50])});
LightLaneTuning.SWEEP_DEPTH          = 0.10;
LightLaneTuning.SWEEP_THICK          = 0.20;
LightLaneTuning.SWEEP_WIDTH          = Object.freeze([6.4, 10.4]);
// Its shape (art § 5.2): a flat swept wing (outline [x, z], `thick`), two fins under it, a slot at its front.
LightLaneTuning.SENTINEL_SHAPE = Object.freeze({
    wing:  Object.freeze([[-1.0, -2.0], [1.0, -2.0], [3.0, 1.0], [1.2, 2.0], [-1.2, 2.0], [-3.0, 1.0]]),
    thick: 0.8,
    fin:   Object.freeze({x: 1.8, size: Object.freeze([0.1, 1.2, 1.6])}),
    slot:  Object.freeze([1.6, 0.4]),
});

// --- The robot (tech § 8.1): every ROBOT_STEP it looks ROBOT_LATENCY ahead, tries each order then a second one
// ROBOT_STEP later, each branch played ROBOT_HORIZON after the latency; a stumble costs ROBOT_STUMBLE, a coin earns 1.
LightLaneTuning.ROBOT_STEP     = 0.15;
LightLaneTuning.ROBOT_LATENCY  = 0.45;
LightLaneTuning.ROBOT_HORIZON  = 1.2;
LightLaneTuning.ROBOT_STUMBLE  = 1000;
// A first order earns ROBOT_SAFETY for each second order that lives without a stumble after it.
LightLaneTuning.ROBOT_SAFETY   = 3;
// A death's cost, far above any stumble: the time it is put off is added (the longest reprieve wins among deaths).
LightLaneTuning.ROBOT_DEATH    = 1000000;
// Drawn shapes (art § 5.2), m. Hurdle: feet at ±halfWidth up to barBottom, a bar from barBottom to barTop, the red
// cross under it over `cross` [x0, y0, x1, y1]. Gate: posts postSize² × postHeight at ±postX, a beam ±beamHalfWidth from
// beamBottom to beamTop, the red cross above it. Block: halfWidth × height, vertical corners cut by `corner` at 45°, its
// crosses kept crossMargin off its top and bottom, the side crosses sideCrossInset short of each other. Coin: an
// octahedron halfWidth across, 2 × halfHeight high, standing on its bottom.
LightLaneTuning.SHAPES = Object.freeze({
    HURDLE: Object.freeze({halfWidth: 0.85, barBottom: 0.65, barTop: 0.90, cross: Object.freeze([-0.70, 0.08, 0.70, 0.58])}),
    GATE:   Object.freeze({postX: 1.02, postSize: 0.08, postHeight: 3.0, beamHalfWidth: 0.95, beamBottom: 1.05, beamTop: 1.45,
        cross: Object.freeze([-0.85, 1.60, 0.85, 2.85])}),
    BLOCK:  Object.freeze({halfWidth: 0.90, height: 3.20, corner: 0.15, crossMargin: 0.1, sideCrossInset: 0.15}),
    COIN:   Object.freeze({halfWidth: 0.11, halfHeight: 0.16}),
});

// --- Deaths (gameplay § 8.2) ---
LightLaneTuning.DYING_TIME = Object.freeze({shock: 1.0, trip: 1.0, fall: 1.2});
// A fall keeps the run's speed (inertia) and goes down under the jump's own gravity, 8H / T² (gameplay § 3.4).
// The speed ahead it keeps in a fall decays as e^(−FALL_FORWARD_DECAY·t) (user request: it slows down quickly; at
// 11 m/s it drifts ≈ 3 m).
LightLaneTuning.FALL_FORWARD_DECAY = 3.5;
LightLaneTuning.FALL_GRAVITY       = ((8 * LightLaneTuning.JUMP_HEIGHT) / (LightLaneTuning.JUMP_TIME * LightLaneTuning.JUMP_TIME));
LightLaneTuning.DEATH_FLASH        = Object.freeze({shock: 0.5, trip: 0.2, fall: 0});
LightLaneTuning.DEATH_SHAKE        = Object.freeze({amplitude: 0.15, time: 0.4});
LightLaneTuning.FALL_LOOK_DOWN     = 20;
LightLaneTuning.FALL_LOOK_TIME     = 0.6;
// The test mode's shield: a fall puts the runner this far ahead, past the longest gap.
LightLaneTuning.SHIELD_FALL_SKIP = 6;

// --- Coins (gameplay § 11.1, generation § 9) ---
LightLaneTuning.COIN_REACH       = 0.25;
LightLaneTuning.COIN_POINTS      = 5;
LightLaneTuning.COIN_HEIGHT      = 0.7;
LightLaneTuning.COIN_LOW_HEIGHT  = 0.4;
LightLaneTuning.COIN_SPACING     = 2.0;
LightLaneTuning.COIN_LINE_CHANCE = 0.55;
LightLaneTuning.COIN_LINE_MIN    = 5;
LightLaneTuning.COIN_LINE_MAX    = 10;
LightLaneTuning.COIN_ARC_COUNT   = 7;
LightLaneTuning.COIN_GATE_COUNT  = 5;
// Spin (degrees a second) and bob (± metres at a frequency) of coins and bonuses (art § 5.2).
LightLaneTuning.COIN_SPIN   = 180;
LightLaneTuning.COIN_BOB    = 0.08;
LightLaneTuning.COIN_BOB_HZ = 1;
// Coins bob out of step: phase step per serial, radians.
LightLaneTuning.COIN_BOB_PHASE_STEP = 1.7;
LightLaneTuning.COIN_TAKE_RISE      = 0.6;
LightLaneTuning.COIN_TAKE_TIME      = 0.15;
// A coin picked up goes on with the runner, at least COIN_TAKE_AHEAD before its centre, as it fades (user request: it
// seemed to go through the runner). No growing: the engine draws a 3D object at its own size (render scale is read by
// billboards only).
LightLaneTuning.COIN_TAKE_AHEAD = 0.4;

// --- Rows (generation § 1, § 4) ---
LightLaneTuning.CELL                = 0.5;
LightLaneTuning.GENERATE_AHEAD      = 160;
LightLaneTuning.RETIRE_BEHIND       = 12;
LightLaneTuning.FIRST_ROW           = 60;
LightLaneTuning.ROW_GAP_JITTER      = 0.4;
LightLaneTuning.LONG_ELEMENT_MARGIN = 0.8;
// A pattern is not drawn again among the last PATTERN_RECENT_MAX (fewer when the tier offers less than that many
// + PATTERN_RECENT_SPARE); a row is mirrored with PATTERN_MIRROR_CHANCE.
LightLaneTuning.PATTERN_RECENT_MAX    = 3;
LightLaneTuning.PATTERN_RECENT_SPARE  = 2;
LightLaneTuning.PATTERN_MIRROR_CHANCE = 0.5;
// Gap between rows, s, by tier (gameplay § 9.1); tiers past the table keep the last.
LightLaneTuning.ROW_GAPS = Object.freeze([1.90, 1.70, 1.50, 1.35, 1.20, 1.10, 1.00, 0.90]);
// A tier's first BREATH_LENGTH metres keep the catalogue of the tier before (gameplay § 9.2); its patterns then come in
// with a weight factor from INTRO_FACTOR to 1 over INTRO_LENGTH metres.
LightLaneTuning.BREATH_LENGTH = 150;
LightLaneTuning.INTRO_LENGTH  = 400;
LightLaneTuning.INTRO_FACTOR  = 0.3;
// A row is drawn again at most ROW_TRIES times when the fairness check refuses it (generation § 4.5), then left empty.
LightLaneTuning.ROW_TRIES = 8;

// --- Sections (generation § 3) ---
LightLaneTuning.SECTION_FIRST       = 400;
LightLaneTuning.SECTION_STEP        = 10;
LightLaneTuning.SECTION_3_MIN       = 250;
LightLaneTuning.SECTION_3_MAX       = 500;
LightLaneTuning.SECTION_5_MIN       = 150;
LightLaneTuning.SECTION_5_MAX       = 300;
// The first section of 5 lanes, forced FIVE_FIRST_AFTER into tier FIVE_TIER, FIVE_FIRST_LENGTH long.
LightLaneTuning.FIVE_TIER           = 2;
LightLaneTuning.FIVE_FIRST_AFTER    = 150;
LightLaneTuning.FIVE_FIRST_LENGTH   = 200;
// Chance of a section of 5 lanes after one of 3: FIVE_CHANCE at tier FIVE_TIER, + FIVE_CHANCE_STEP a tier, FIVE_CHANCE_MAX.
LightLaneTuning.FIVE_CHANCE         = 0.35;
LightLaneTuning.FIVE_CHANCE_STEP    = 0.05;
LightLaneTuning.FIVE_CHANCE_MAX     = 0.60;
// Before the outer lanes end: the warning zone, WARN_TIME × the target speed (from its tile's start), and in its last
// CLEAR_TIME × the target speed the lanes −1 and +1 kept free.
LightLaneTuning.WARN_TIME           = 2.5;
LightLaneTuning.CLEAR_TIME          = 1.2;
// The warning zone's red edges blink at this rate (art § 5.2, tileWarn).
LightLaneTuning.WARN_BLINK_HZ       = 4;

// --- Fairness check (generation § 8) ---
LightLaneTuning.FAIR_REACTION    = 0.45;
LightLaneTuning.FAIR_GATE_SLIDE  = 0.70;
// From tier 1 the jump boots can be on: a jump lasts JUMP_TIME_BOOTS; at tier 0 JUMP_TIME.
LightLaneTuning.FAIR_BOOTS_TIER  = 1;

// --- First encounters (generation § 6): the row of each novelty, ENCOUNTER_AFTER into its tier ---
LightLaneTuning.ENCOUNTER_AFTER = 150;
LightLaneTuning.ENCOUNTERS      = Object.freeze([
    Object.freeze({tier: 1, pattern: 'N1'}),
    Object.freeze({tier: 3, pattern: 'E2'}),
    Object.freeze({tier: 4, pattern: 'G2'}),
    Object.freeze({tier: 5, pattern: 'C2'}),
]);
// The gaps before and after a first encounter's row, times the normal one.
LightLaneTuning.ENCOUNTER_GAP = 1.5;

// --- Bonuses (generation § 7.1; their effects come with plan step 12) ---
// The first, a magnet on lane 0 with no obstacle, BONUS_FIRST_AFTER into tier 1; then every BONUS_EVERY metres
// ([min, max] by tier from its `from`).
LightLaneTuning.BONUS_FIRST_TIER  = 1;
LightLaneTuning.BONUS_FIRST_AFTER = 230;
LightLaneTuning.BONUS_FIRST_TYPE  = 'magnet';
LightLaneTuning.BONUS_EVERY       = Object.freeze([
    Object.freeze({from: 1, min: 400, max: 650}),
    Object.freeze({from: 4, min: 550, max: 900}),
]);
// Draw weights; flight comes with plan step 12 (its reservations, generation § 7.1).
LightLaneTuning.BONUS_TYPES  = Object.freeze({double: 25, magnet: 25, shield: 20, boots: 15});
LightLaneTuning.BONUS_HEIGHT = 0.9;

// --- Scenery zones (generation § 7.3; drawn from plan step 13) ---
LightLaneTuning.ZONE_LENGTH = 800;
LightLaneTuning.ZONES       = Object.freeze(['grid', 'hex', 'dots', 'arches']);

// --- Effects (art § 7) ---
LightLaneTuning.SHARD_COUNT      = 48;
LightLaneTuning.SHARD_SPEED_MIN  = 3;
LightLaneTuning.SHARD_SPEED_MAX  = 9;
LightLaneTuning.SHARD_GRAVITY    = 9;
LightLaneTuning.SHARD_LIFE       = 0.9;
LightLaneTuning.SHARD_SPIN       = 540;
LightLaneTuning.SHARD_SIZE       = 0.12;
LightLaneTuning.FLASH_TIME       = 0.3;
LightLaneTuning.FRAGILE_BLINK_HZ = 4;

// --- Game over (art § 10) ---
LightLaneTuning.GAME_OVER_INPUT_LOCK = 0.4;


// --- Gallery (gameplay § 14, art § 10) ---
// Its items in their order: an element of each kind passed alive (a bike without its trail, then with it: user request),
// the Sentinel's pass survived, the runner.
LightLaneTuning.GALLERY_ITEMS           = Object.freeze(['hurdle', 'gate', 'block', 'gap', 'bike', 'bikeTrail', 'sentinel', 'runner']);
// The runner unlocked by this many metres run in a run (user request).
LightLaneTuning.GALLERY_RUNNER_DISTANCE = 10000;
// The item turns on its own once in this many seconds, until the player turns it (Left / Right held: degrees a second).
LightLaneTuning.GALLERY_TURN_PERIOD     = 8;
LightLaneTuning.GALLERY_TURN_SPEED      = 120;
// A finger's turn: degrees a pixel (across: about the item; up and down: the camera over or under it, up to PITCH_MAX).
LightLaneTuning.GALLERY_TURN_SWIPE      = 0.5;
LightLaneTuning.GALLERY_PITCH_MAX       = 85;
// Seen from above, degrees; its bounding sphere fills the view but this margin (the camera this much farther away).
LightLaneTuning.GALLERY_PITCH           = 15;
LightLaneTuning.GALLERY_MARGIN          = 1.15;
// The runner's clips in turn, each for its duration (one jump, one slide, a few strides between).
LightLaneTuning.GALLERY_RUNNER_CLIPS    = Object.freeze([['run', 2], ['jump', LightLaneTuning.JUMP_TIME], ['run', 1.5], ['slide', LightLaneTuning.SLIDE_TIME]]);