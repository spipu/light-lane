/**
 * Every tuning value of the game (gameplay, art § 2, § 3, § 4, § 8), one place: the code never writes a number of
 * the design inline. Lengths in metres, times in seconds, speeds in m/s, angles in degrees. Grouped as the specs are;
 * each step of the plan adds its own group.
 */
class LightLaneTuning {
}

// --- Time (gameplay § 1) ---
LightLaneTuning.STEP_SECONDS   = (1 / 120);
LightLaneTuning.MS_PER_SECOND  = 1000;

// --- Lanes and tiles (gameplay § 2, art § 5.2) ---
LightLaneTuning.LANE_WIDTH     = 2.0;
LightLaneTuning.LANES_3        = [-1, 0, 1];
LightLaneTuning.LANES_5        = [-2, -1, 0, 1, 2];
LightLaneTuning.TILE_LENGTH    = 10.0;
LightLaneTuning.TILE_THICKNESS = 0.3;
// Cross marks on every tile, every TILE_MARK_STEP from its start: they show the run's speed (user request); painted
// FLOOR_MARK, no glow.
LightLaneTuning.TILE_MARK_STEP  = 5.0;
LightLaneTuning.TILE_MARK_WIDTH = 0.10;
LightLaneTuning.TILE_MARK_RAISE = 0.02;
// The track is drawn this far behind and ahead of the runner (far plane, art § 2).
LightLaneTuning.TRACK_BEHIND   = 10;
LightLaneTuning.TRACK_AHEAD    = 140;

// --- Difficulty (gameplay § 9.1): start distance (m) and target speed (m/s) of each tier ---
LightLaneTuning.TIERS = [
    {from: 0,    speed: 11.0},
    {from: 300,  speed: 12.5},
    {from: 700,  speed: 14.0},
    {from: 1200, speed: 15.5},
    {from: 1800, speed: 17.0},
    {from: 2500, speed: 18.5},
    {from: 3300, speed: 20.0},
    {from: 4200, speed: 21.5},
];
// Tiers 8 to 12: one every TIER_LATE_LENGTH metres after tier 7, TIER_LATE_SPEED_STEP faster, capped.
LightLaneTuning.TIER_LATE_LENGTH     = 1000;
LightLaneTuning.TIER_LATE_SPEED_STEP = 1.0;
LightLaneTuning.TIER_LAST            = 12;
LightLaneTuning.SPEED_MAX            = 26.0;
// On entering a tier, the speed reaches its target linearly in this time.
LightLaneTuning.TIER_RAMP_SECONDS    = 6.0;

// --- Countdown (gameplay § 8.1) ---
LightLaneTuning.COUNTDOWN_DIGITS      = [3, 2, 1];
LightLaneTuning.COUNTDOWN_DIGIT_TIME  = 0.6;
LightLaneTuning.COUNTDOWN_GO_TIME     = 0.4;

// --- Runner animation (art § 6.2) ---
// A lane change leans the whole runner (pivot at the feet) towards its move while the run clip goes on (user request:
// a lane clip broke the stride); reached and left in RUNNER_LEAN_TIME.
LightLaneTuning.RUNNER_LEAN         = 12;
LightLaneTuning.RUNNER_LEAN_TIME    = 0.06;
LightLaneTuning.FADE_SHORT_CLIP       = 0.12;
// Playback speed of run: min(RUN_PACE_BASE + (v − RUN_PACE_FROM) / RUN_PACE_SPAN × RUN_PACE_GAIN, RUN_PACE_MAX).
LightLaneTuning.RUN_PACE_BASE         = 1.0;
LightLaneTuning.RUN_PACE_FROM         = 11;
LightLaneTuning.RUN_PACE_SPAN         = 15;
LightLaneTuning.RUN_PACE_GAIN         = 0.8;
LightLaneTuning.RUN_PACE_MAX          = 1.8;

// --- Camera (art § 8) ---
LightLaneTuning.CAMERA_HEIGHT_BASE    = 3.0;
LightLaneTuning.CAMERA_HEIGHT_FEET    = 0.35;
LightLaneTuning.CAMERA_ABOVE_FEET     = 2.2;
LightLaneTuning.CAMERA_FOLLOW_RATE    = 12;
LightLaneTuning.CAMERA_BACK           = 5.2;
LightLaneTuning.CAMERA_PITCH          = -14;
LightLaneTuning.CAMERA_ROLL           = 1.5;
LightLaneTuning.CAMERA_ROLL_BACK_TIME = 0.2;
LightLaneTuning.CAMERA_FOV            = 36;

// --- Scene (art § 2) ---
LightLaneTuning.AMBIENT               = [255, 255, 255];
// Test (user request, 2026-11-13): a light at the runner's centre, range RUNNER_LIGHT_RANGE × its half height. A light
// never makes a face brighter than its painted colour (Object3dRendererBase._pointColor clamps ambient + lights to
// 255): with it on, the ambient goes down to AMBIENT_LIT and the tiles' tops are cut in cells of TILE_TOP_CELL (the
// light is computed at the vertices).
LightLaneTuning.RUNNER_LIGHT_ON       = true;
// (120, 200, 220) raised by 25 %, then by 50 % (user requests); a component over 255 is fine: only ambient + lights
// is clamped, so a stronger light mostly widens the part brought to the full painted colour.
LightLaneTuning.RUNNER_LIGHT_COLOR    = [225, 375, 412];
LightLaneTuning.RUNNER_LIGHT_RANGE    = 2.0;
// With the light on, the ambient is a third: the floor is painted LIGHT_COMPENSATION times lighter (the same away
// from the light, up to that many times lighter in it) and every other face keeps its look through its light group's
// factor (LightLaneModels.LIGHT_GROUP) or its instance's render light.
LightLaneTuning.AMBIENT_LIT           = [85, 85, 85];
LightLaneTuning.LIGHT_COMPENSATION    = (LightLaneTuning.RUNNER_LIGHT_ON ? (255 / LightLaneTuning.AMBIENT_LIT[0]) : 1);
LightLaneTuning.TILE_TOP_CELL         = 0.5;
// The tiles one tile further than the lit ones: their top in cells of TILE_MID_CELL (user request: an intermediate
// level of detail before the finest).
LightLaneTuning.TILE_MID_CELL         = 1.0;
LightLaneTuning.BACKGROUND            = [10, 20, 24];
LightLaneTuning.Z_NEAR                = 0.2;
LightLaneTuning.Z_FAR                 = 140;
LightLaneTuning.DEPTH_SHADING         = Object.freeze({visibility: 50.7, visibilityMax: 10, shadeBase: 1.268, shadeScale: 0, rampCount: 32, strength: 1});

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
    HORIZON:        [60, 150, 170],
});

// --- Lines (art § 4) ---
LightLaneTuning.LINE_SIZE         = 0.08;
LightLaneTuning.LINE_SIZE_DECOR   = 0.05;
LightLaneTuning.LINE_SIZE_FAR     = 0.20;
LightLaneTuning.LINE_SIZE_DECOR_FAR = 0.12;
LightLaneTuning.LINE_OUTSET       = 0.01;
// The far variant takes over when a line would be under LINE_FAR_PIXELS on screen, and gives way under
// LINE_NEAR_RATIO × that distance.
LightLaneTuning.LINE_FAR_PIXELS   = 1.5;
LightLaneTuning.LINE_NEAR_RATIO   = 0.9;
// Horizon line (art § 5.2): length, height, distance ahead of the runner.
LightLaneTuning.HORIZON_LENGTH    = 400;
LightLaneTuning.HORIZON_Y         = -1;
LightLaneTuning.HORIZON_AHEAD     = 135;

// --- Commands (gameplay § 10) ---
// Gamepad stick: the dominant axis past STICK_TRIGGER makes an order; re-armed once both axes are under STICK_REARM.
LightLaneTuning.STICK_TRIGGER     = 0.6;
LightLaneTuning.STICK_REARM       = 0.3;

// --- Runner (gameplay § 3) ---
LightLaneTuning.RUNNER_HALF_WIDTH  = 0.30;
LightLaneTuning.RUNNER_HALF_DEPTH  = 0.25;
LightLaneTuning.RUNNER_HEIGHT      = 1.75;
LightLaneTuning.RUNNER_SLIDE_HEIGHT = 0.80;
LightLaneTuning.LANE_CHANGE_TIME   = 0.16;
LightLaneTuning.JUMP_HEIGHT        = 1.40;
LightLaneTuning.JUMP_TIME          = 0.75;
LightLaneTuning.JUMP_HEIGHT_BOOTS  = 2.40;
LightLaneTuning.JUMP_TIME_BOOTS    = 0.95;
LightLaneTuning.FAST_DROP_SPEED    = 18;
LightLaneTuning.SLIDE_TIME         = 0.70;
LightLaneTuning.ORDER_KEEP_TIME    = 0.20;
LightLaneTuning.STUMBLE_SLOW       = 0.85;
LightLaneTuning.STUMBLE_SLOW_TIME  = 1.0;
LightLaneTuning.STUMBLE_RAMP_TIME  = 0.5;
LightLaneTuning.FRAGILE_TIME       = 5.0;
LightLaneTuning.STUMBLE_SHAKE      = Object.freeze({amplitude: 0.08, time: 0.25});

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
});

// --- Deaths (gameplay § 8.2) ---
LightLaneTuning.DYING_TIME          = Object.freeze({shock: 1.0, trip: 1.0, fall: 1.2});
// A fall keeps the run's speed (inertia) and goes down under the jump's own gravity, 8H / T² (gameplay § 3.4).
// The speed ahead it keeps in a fall decays as e^(−FALL_FORWARD_DECAY·t) (user request: it slows down quickly; at
// 11 m/s it drifts ≈ 3 m).
LightLaneTuning.FALL_FORWARD_DECAY  = 3.5;
LightLaneTuning.FALL_GRAVITY        = ((8 * LightLaneTuning.JUMP_HEIGHT) / (LightLaneTuning.JUMP_TIME * LightLaneTuning.JUMP_TIME));
LightLaneTuning.DEATH_FLASH         = Object.freeze({shock: 0.5, trip: 0.2, fall: 0});
LightLaneTuning.DEATH_SHAKE         = Object.freeze({amplitude: 0.15, time: 0.4});
LightLaneTuning.FALL_LOOK_DOWN      = 20;
LightLaneTuning.FALL_LOOK_TIME      = 0.6;

// --- Coins (gameplay § 11.1, generation § 9) ---
LightLaneTuning.COIN_REACH          = 0.25;
LightLaneTuning.COIN_POINTS         = 5;
LightLaneTuning.COIN_HEIGHT         = 0.7;
LightLaneTuning.COIN_LOW_HEIGHT     = 0.4;
LightLaneTuning.COIN_SPACING        = 2.0;
LightLaneTuning.COIN_LINE_CHANCE    = 0.55;
LightLaneTuning.COIN_LINE_MIN       = 5;
LightLaneTuning.COIN_LINE_MAX       = 10;
LightLaneTuning.COIN_ARC_COUNT      = 7;
LightLaneTuning.COIN_GATE_COUNT     = 5;
// Spin (degrees a second) and bob (± metres at a frequency) of coins and bonuses (art § 5.2).
LightLaneTuning.COIN_SPIN           = 180;
LightLaneTuning.COIN_BOB            = 0.08;
LightLaneTuning.COIN_BOB_HZ         = 1;
LightLaneTuning.COIN_TAKE_RISE      = 0.6;
LightLaneTuning.COIN_TAKE_TIME      = 0.15;

// --- Rows (generation § 1, § 4) ---
LightLaneTuning.CELL                = 0.5;
LightLaneTuning.GENERATE_AHEAD      = 160;
LightLaneTuning.RETIRE_BEHIND       = 12;
LightLaneTuning.FIRST_ROW           = 60;
LightLaneTuning.ROW_GAP_JITTER      = 0.4;
LightLaneTuning.LONG_ELEMENT_MARGIN = 0.8;
// Gap between rows, s, by tier (gameplay § 9.1); tiers past the table keep the last.
LightLaneTuning.ROW_GAPS            = Object.freeze([1.90, 1.70, 1.50, 1.35, 1.20, 1.10, 1.00, 0.90]);

// --- Effects (art § 7) ---
LightLaneTuning.SHARD_COUNT         = 48;
LightLaneTuning.SHARD_SPEED_MIN     = 3;
LightLaneTuning.SHARD_SPEED_MAX     = 9;
LightLaneTuning.SHARD_GRAVITY       = 9;
LightLaneTuning.SHARD_LIFE          = 0.9;
LightLaneTuning.SHARD_SPIN          = 540;
LightLaneTuning.SHARD_SIZE          = 0.12;
LightLaneTuning.FLASH_TIME          = 0.3;
LightLaneTuning.FRAGILE_BLINK_HZ    = 4;

// --- Game over (art § 10) ---
LightLaneTuning.GAME_OVER_INPUT_LOCK = 0.4;

