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

        return this._failures;
    }

    _check(label, ok) {
        if (!ok) {
            this._failures++;
        }
        console.log(((ok) ? '  ok   ' : '  FAIL ') + label);
    }
}

module.exports = {run: () => new ModelsBench().run()};
