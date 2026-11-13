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
LightLaneTuning.FADE_SHORT_CLIP       = 0.12;
LightLaneTuning.FADE_LANE_CLIP        = 0.06;
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
LightLaneTuning.BACKGROUND            = [10, 20, 24];
LightLaneTuning.Z_NEAR                = 0.2;
LightLaneTuning.Z_FAR                 = 140;
LightLaneTuning.DEPTH_SHADING         = Object.freeze({visibility: 50.7, visibilityMax: 10, shadeBase: 1.268, shadeScale: 0, rampCount: 32, strength: 1});

// --- Palette (art § 3), 0-255 ---
LightLaneTuning.COLOR = Object.freeze({
    BG:             [10, 20, 24],
    FLOOR_TOP:      [14, 26, 32],
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
