/**
 * The objects built in code (art § 5.2), as Object3dLoader data, and the runner's glTF: loaded inside the loader batch
 * of the run, kept by code. Origin of an object: the centre of its bottom, its front towards −z; a face that glows
 * says so in its data (glow: true). Every object with lines has a far variant (code + LightLaneModels.FAR_SUFFIX) with
 * thicker lines (art § 4). Built with LightLaneObjectBuilder.
 */
class LightLaneModels {
    // Inside the loader batch.
    static load() {
        const color = LightLaneTuning.COLOR;
        const decor = [LightLaneTuning.LINE_SIZE_DECOR, LightLaneTuning.LINE_SIZE_DECOR_FAR];
        [false, true].forEach((far, i) => {
            const suffix = ((far) ? LightLaneModels.FAR_SUFFIX : '');
            loader.objects().loadFromData(LightLaneModels.TILE + suffix, LightLaneModels._tile(decor[i]));
            loader.objects().loadFromData(LightLaneModels.TILE_EDGE + suffix, LightLaneModels._tileEdge(decor[i]));
        });
        const horizon = new LightLaneObjectBuilder();
        const half    = (LightLaneTuning.HORIZON_LENGTH / 2);
        horizon.line([-half, 0, 0], [half, 0, 0], LightLaneTuning.LINE_SIZE_DECOR_FAR, color.HORIZON);
        loader.objects().loadFromData(LightLaneModels.HORIZON, horizon.data());
        loader.animatedModels().loadByCode(LightLaneModels.RUNNER, LightLaneModels.ASSETS + 'models/runner.gltf');
    }

    /**
     * @param {string} code
     * @returns {int} the id of the object of that code
     */
    static objectId(code) {
        return loader.objects().getByCode(code).getId();
    }

    // A lane's tile: a slab, its top at the origin's height + TILE_THICKNESS, a line along its top left edge.
    static _tile(lineSize) {
        const color = LightLaneTuning.COLOR;
        const w     = (LightLaneTuning.LANE_WIDTH / 2);
        const l     = (LightLaneTuning.TILE_LENGTH / 2);
        const h     = LightLaneTuning.TILE_THICKNESS;
        const b     = new LightLaneObjectBuilder();
        b.box([-w, 0, -l], [w, h, l], {top: color.FLOOR_TOP, side: color.BODY_SIDE, bottom: color.BODY_BOTTOM});
        b.line([-w, h, -l], [-w, h, l], lineSize, color.LINE_DIM);

        return b.data();
    }

    // The line along the right edge of the rightmost lane, alone.
    static _tileEdge(lineSize) {
        const w = (LightLaneTuning.LANE_WIDTH / 2);
        const l = (LightLaneTuning.TILE_LENGTH / 2);
        const h = LightLaneTuning.TILE_THICKNESS;
        const b = new LightLaneObjectBuilder();
        b.line([w, h, -l], [w, h, l], lineSize, LightLaneTuning.COLOR.LINE_DIM);

        return b.data();
    }
}

LightLaneModels.ASSETS     = './assets/lightLane/';
LightLaneModels.FAR_SUFFIX = 'Far';
LightLaneModels.TILE       = 'tile';
LightLaneModels.TILE_EDGE  = 'tileEdge';
LightLaneModels.HORIZON    = 'horizon';
LightLaneModels.RUNNER     = 'runner';
