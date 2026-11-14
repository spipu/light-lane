/**
 * Commands suite (gameplay § 10): LightLaneControls.readStick and LightLaneCommandSampler read in a vm over a fake
 * gamepad. The stick turned into the orders' convention (the gamepad reads down positive: up is a jump), its dominant
 * axis past STICK_TRIGGER making one order, re-armed only under STICK_REARM on both axes; a held button firing once.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const {Checker} = require('../lib/gameContext.js');

const WEBSITE_DIR = path.resolve(__dirname, '..', '..', 'website');
const SOURCES     = [
    'js/lightLane/lightLaneTuning.js',
    'js/lightLane/game/lightLaneCommandSampler.js',
    'js/lightLane/game/lightLaneControls.js',
];

function load() {
    const ctx = vm.createContext({
        console, Math, Object, Array, Map, Set, Error, Number, String, JSON, Infinity,
        AppInputSwipe:     {LEFT: 'left', RIGHT: 'right', UP: 'up', DOWN: 'down'},
        LightLaneSettings: {DEVICE_AUTO: 'auto', DEVICE_KEYBOARD: 'keyboard', DEVICE_GAMEPAD: 'gamepad', DEVICE_VIRTUAL_PAD: 'virtualPad'}
    });
    for (const file of SOURCES) {
        vm.runInContext(fs.readFileSync(path.join(WEBSITE_DIR, file), 'utf8'), ctx, {filename: file});
    }

    return (name) => vm.runInContext(name, ctx);
}

// The controls of a gamepad whose axes and jump button the test sets (hardware convention: right and down positive).
function fakeControls(get) {
    const Controls = get('LightLaneControls');
    const pad      = {axes: {leftRight: 0, jumpSlide: 0}, jump: false};
    const controls = Object.create(Controls.prototype);
    controls._device  = get('LightLaneSettings').DEVICE_GAMEPAD;
    controls._gamepad = {readSlot: (slot) => pad.axes[slot]};
    controls.readButtonLeft  = () => false;
    controls.readButtonRight = () => false;
    controls.readButtonJump  = () => pad.jump;
    controls.readButtonSlide = () => false;
    controls.pollSwipe       = () => null;
    controls.clearSwipes     = () => controls;

    return {controls, pad};
}

function run() {
    const get     = load();
    const Sampler = get('LightLaneCommandSampler');
    const Tuning  = get('LightLaneTuning');
    const c       = new Checker();
    const out     = [];
    const {controls, pad} = fakeControls(get);
    const sampler = new Sampler(controls).restart();
    const frame   = (x, y) => {
        pad.axes.leftRight = x;
        pad.axes.jumpSlide = y;

        return sampler.sample(0, out).join(',');
    };

    c.check('stick read up positive', (controls.readStick({x: 0, y: 0}).y === 0) && (frame(0, 0) === ''));
    c.check('stick pushed up (hardware −1): a jump', (frame(0, -1) === Sampler.JUMP));
    c.check('held: no repeat', (frame(0, -1) === ''));
    c.check('back over STICK_REARM: still not re-armed', ((frame(0, -(Tuning.STICK_REARM + 0.05)) === '') && (frame(0, -1) === '')));
    frame(0, 0);
    c.check('re-armed, pushed down (hardware +1): a slide', (frame(0, 1) === Sampler.SLIDE));
    frame(0, 0);
    c.check('under STICK_TRIGGER: nothing', (frame(Tuning.STICK_TRIGGER - 0.05, 0) === ''));
    c.check('past it to the left: left', (frame(-(Tuning.STICK_TRIGGER + 0.05), 0) === Sampler.LEFT));
    frame(0, 0);
    c.check('dominant axis wins (right over a smaller up)', (frame(0.9, -0.7) === Sampler.RIGHT));
    frame(0, 0);
    pad.jump = true;
    c.check('button down: one order', (frame(0, 0) === Sampler.JUMP));
    c.check('button held: none', (frame(0, 0) === ''));
    pad.jump = false;
    frame(0, 0);
    pad.jump = true;
    sampler.discard();
    c.check('button held through a discard (pause): does not fire', (frame(0, 0) === ''));

    return c.failures;
}

module.exports = {run};
