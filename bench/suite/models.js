/**
 * Models suite: every model file of website/assets/lightLane/models/ read by the engine's own GltfParser (in a vm,
 * without a browser), against art § 6: the runner's 13 joints, its clips and their durations, its triangle budget
 * (tech § 9: 3 000) and its glowing line material.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const WEBSITE_DIR = path.resolve(__dirname, '..', '..', 'website');
const MODEL_DIR   = path.join(WEBSITE_DIR, 'assets', 'lightLane', 'models');
const SOURCES     = [
    'js/engine/animation/mat4.js',
    'js/engine/animation/quaternion.js',
    'js/engine/animation/skeleton.js',
    'js/engine/animation/skeletonPose.js',
    'js/engine/animation/animationSampler.js',
    'js/engine/animation/animationChannel.js',
    'js/engine/animation/animationEvent.js',
    'js/engine/animation/animationClip.js',
    'js/engine/animation/skeletonSocket.js',
    'js/engine/model/modelMesh.js',
    'js/engine/animation/skinnedMesh.js',
    'js/engine/loader/gltfParser.js',
];
const RUNNER_JOINTS    = ['pelvis', 'torso', 'head', 'upperArmLeft', 'forearmLeft', 'upperArmRight', 'forearmRight',
    'thighLeft', 'shinLeft', 'footLeft', 'thighRight', 'shinRight', 'footRight'];
// art § 6.2: the keyed clips' durations; idle and run last one captured cycle.
const RUNNER_CLIPS     = {idle: null, run: null, jump: 0.75, slide: 0.70, stumble: 0.60, fall: 0.80, flight: 1.0};
const RUNNER_TRIANGLES = 3000;
const DURATION_EPSILON = 1e-6;

// The objects built in code and what they read (tech § 9 budgets: an enemy 800 triangles, the Sentinel 1 500, any other
// 300; a whole row of tiles 300 a lane; a block 300 + 25 a metre).
const BUILT_SOURCES      = ['js/lightLane/lightLaneTuning.js', 'js/lightLane/game/lightLaneObjectBuilder.js', 'js/lightLane/game/lightLaneEntity.js', 'js/lightLane/game/lightLaneModels.js'];
const ENEMY_TRIANGLES    = 800;
const SENTINEL_TRIANGLES = 1500;
const OTHER_TRIANGLES    = 300;
const BLOCK_PER_METRE    = 25;

class ModelsBench {
    constructor() {
        this._failures = 0;
        this._ctx      = vm.createContext({console, Math, Float32Array, Float64Array, Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, DataView, Map, Set, Object, Array, Error, Number});
        for (const file of SOURCES) {
            vm.runInContext(fs.readFileSync(path.join(WEBSITE_DIR, file), 'utf8'), this._ctx, {filename: file});
        }
        this._parser = vm.runInContext('GltfParser', this._ctx);
    }

    run() {
        const gltf   = JSON.parse(fs.readFileSync(path.join(MODEL_DIR, 'runner.gltf'), 'utf8'));
        const bytes  = fs.readFileSync(path.join(MODEL_DIR, gltf.buffers[0].uri));
        const binary = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        let model;
        try {
            model = this._parser.parse(gltf, binary);
        } catch (error) {
            this._check('runner: read by GltfParser (' + error.message + ')', false);
            return this._failures;
        }
        const skeleton = model.skeleton;
        const names    = [...Array(skeleton.getJointCount()).keys()].map((joint) => skeleton.getJointName(joint));
        // The parser orders the joints parents first (GltfParser._jointOrder): compared as a set.
        this._check('runner: the 13 joints of the mannequin', ([...names].sort().join(',') === [...RUNNER_JOINTS].sort().join(',')));

        const clips = new Map(model.clips.map((clip) => [clip.getName(), clip]));
        this._check('runner: the clips of art § 6.2', ([...clips.keys()].sort().join(',') === Object.keys(RUNNER_CLIPS).sort().join(',')));
        for (const [name, duration] of Object.entries(RUNNER_CLIPS)) {
            const clip = clips.get(name);
            const ok   = ((clip !== undefined) && ((duration === null) ? (clip.getDuration() > 0) : (Math.abs(clip.getDuration() - duration) < DURATION_EPSILON)));
            this._check('runner: ' + name + ' lasts ' + ((duration === null) ? 'one cycle' : (duration + ' s')), ok);
        }

        const triangles = gltf.meshes[0].primitives.reduce((sum, primitive) => (sum + (gltf.accessors[primitive.indices].count / 3)), 0);
        this._check('runner: ' + triangles + ' triangles, budget ' + RUNNER_TRIANGLES, (triangles <= RUNNER_TRIANGLES));

        // The parser keeps the materials in their order, without their names.
        const named = (name) => model.materials[gltf.materials.findIndex((material) => (material.name === name))];
        const line  = named('line');
        this._check('runner: the line material glows', ((line !== undefined) && (line.extras.glow === true)));
        const suit  = named('suit');
        this._check('runner: the suit material does not glow', ((suit !== undefined) && (suit.extras.glow !== true)));
        this._builtModels();

        return this._failures;
    }

    // The objects built in code (LightLaneModels): the enemies and the Sentinel within their budgets (tech § 9), every
    // face a triangle, glowing faces present; then every object load() builds within its budget.
    _builtModels() {
        const loaded = [];
        const ctx = vm.createContext({console, Math, Object, Array, Map, Set, Error, Number, String,
            loader: {objects: () => ({loadFromData: (code, data) => loaded.push([code, data.faces.length])}), textures: () => ({load: () => 0}), animatedModels: () => ({loadByCode: () => null})}});
        for (const file of BUILT_SOURCES) {
            vm.runInContext(fs.readFileSync(path.join(WEBSITE_DIR, file), 'utf8'), ctx, {filename: file});
        }
        const built = vm.runInContext('({models: LightLaneModels, tuning: LightLaneTuning})', ctx);
        const cases = [
            ['prowler', built.models._enemy(0, false), ENEMY_TRIANGLES],
            ['stalker', built.models._enemy(-1, false), ENEMY_TRIANGLES],
            ['stalker warning', built.models._enemy(1, true), ENEMY_TRIANGLES],
            ['Sentinel', built.models._sentinel(built.tuning.COLOR.WARN), SENTINEL_TRIANGLES],
        ];
        for (const [name, data, budget] of cases) {
            const triangles = data.faces.length;
            const ok        = ((triangles <= budget) && data.faces.every((face) => (face.pts.length === 3)) && data.faces.some((face) => (face.glow === true)));
            this._check(name + ': ' + triangles + ' triangles, budget ' + budget + ', glowing lines', ok);
        }
        vm.runInContext('LightLaneModels.load(false)', ctx);
        const over = loaded.filter(([code, triangles]) => (triangles > ModelsBench._budget(code)));
        this._check('every built object (' + loaded.length + ') within its budget' + ((over.length > 0) ? (': over ' + over.map(([code, n]) => (code + ' ' + n + '/' + ModelsBench._budget(code))).join(', ')) : ''), (over.length === 0));
    }

    static _budget(code) {
        if (code.startsWith('prowler') || code.startsWith('stalker')) {
            return ENEMY_TRIANGLES;
        }
        if (code.startsWith('sentinel')) {
            return SENTINEL_TRIANGLES;
        }
        const row = /^row(\d)/.exec(code);
        if (row !== null) {
            return (OTHER_TRIANGLES * Number(row[1]));
        }
        const block = /^block(\d+)/.exec(code);
        if (block !== null) {
            return (OTHER_TRIANGLES + (BLOCK_PER_METRE * Number(block[1])));
        }

        return OTHER_TRIANGLES;
    }

    _check(label, ok) {
        if (!ok) {
            this._failures++;
        }
        console.log(((ok) ? '  ok   ' : '  FAIL ') + label);
    }
}

module.exports = {run: () => new ModelsBench().run()};
