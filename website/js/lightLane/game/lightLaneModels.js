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
        const lines = [LightLaneTuning.LINE_SIZE, LightLaneTuning.LINE_SIZE_FAR];
        [false, true].forEach((far, i) => {
            const suffix = ((far) ? LightLaneModels.FAR_SUFFIX : '');
            loader.objects().loadFromData(LightLaneModels.HURDLE + suffix, LightLaneModels._hurdle(lines[i]));
            loader.objects().loadFromData(LightLaneModels.GATE + suffix, LightLaneModels._gate(lines[i]));
            for (const code of LightLaneModels.BLOCKS) {
                loader.objects().loadFromData(LightLaneModels.blockCode(code) + suffix, LightLaneModels._block(LightLaneTuning.OBSTACLES[code].length, lines[i]));
            }
            for (const code of LightLaneModels.GAPS) {
                loader.objects().loadFromData(LightLaneModels.gapTileCode(code) + suffix, LightLaneModels._gapTile(LightLaneTuning.OBSTACLES[code], decor[i], lines[i]));
            }
        });
        loader.objects().loadFromData(LightLaneModels.COIN, LightLaneModels._coin());
        for (const [name, rgb] of Object.entries(LightLaneModels.SHARD_COLORS)) {
            loader.objects().loadFromData(LightLaneModels.SHARD + name, LightLaneModels._shard(color[rgb]));
        }
        const horizon = new LightLaneObjectBuilder();
        const half    = (LightLaneTuning.HORIZON_LENGTH / 2);
        horizon.line([-half, 0, 0], [half, 0, 0], LightLaneTuning.LINE_SIZE_DECOR_FAR, color.HORIZON);
        loader.objects().loadFromData(LightLaneModels.HORIZON, horizon.data());
        loader.animatedModels().loadByCode(LightLaneModels.RUNNER, LightLaneModels.ASSETS + 'models/runner.gltf');
    }

    /**
     * @param {string} code - B3, B6, B10, B16
     * @returns {string} the code of its object
     */
    static blockCode(code) {
        return ('block' + code.slice(1));
    }

    /**
     * @param {string} code - X3, X5
     * @returns {string} the code of the tile holed for it
     */
    static gapTileCode(code) {
        return ('tileGap' + code.slice(1));
    }

    /**
     * @param {LightLaneEntity} entity - an obstacle
     * @returns {string|null} the code of its object, null for a gap (drawn as its holed tile)
     */
    static obstacleCode(entity) {
        switch (entity.kind) {
            case LightLaneEntity.HURDLE:
                return LightLaneModels.HURDLE;
            case LightLaneEntity.GATE:
                return LightLaneModels.GATE;
            case LightLaneEntity.BLOCK:
                return LightLaneModels.blockCode(entity.code);
            case LightLaneEntity.COIN:
                return LightLaneModels.COIN;
            default:
                return null;
        }
    }

    /**
     * @param {string} code
     * @returns {int} the id of the object of that code
     */
    static objectId(code) {
        return loader.objects().getByCode(code).getId();
    }

    // A lane's tile: a slab, its top at the origin's height + TILE_THICKNESS, a line along its top left edge, cross
    // lines every TILE_MARK_STEP from its start (they show the speed).
    static _tile(lineSize) {
        const color = LightLaneTuning.COLOR;
        const w     = (LightLaneTuning.LANE_WIDTH / 2);
        const l     = (LightLaneTuning.TILE_LENGTH / 2);
        const h     = LightLaneTuning.TILE_THICKNESS;
        const b     = new LightLaneObjectBuilder();
        LightLaneModels._slab(b, -l, l);
        b.line([-w, h, -l], [-w, h, l], lineSize, color.LINE_DIM);
        LightLaneModels._marks(b, -l, l);

        return b.data();
    }

    // A slab of a tile from z0 to z1; with the runner's light on, its top cut in cells of TILE_TOP_CELL so the light,
    // computed at the vertices, shows on it.
    static _slab(b, z0, z1) {
        const color = LightLaneTuning.COLOR;
        const w     = (LightLaneTuning.LANE_WIDTH / 2);
        const h     = LightLaneTuning.TILE_THICKNESS;
        const faces = {top: color.FLOOR_TOP, side: color.BODY_SIDE, bottom: color.BODY_BOTTOM};
        if (!LightLaneTuning.RUNNER_LIGHT_ON) {
            b.box([-w, 0, z0], [w, h, z1], faces);
            return;
        }
        // The box without its top, then the top in cells.
        b.box([-w, 0, z0], [w, (h - LightLaneModels.TOP_INSET), z1], faces);
        const cell = LightLaneTuning.TILE_TOP_CELL;
        const nx   = Math.round((2 * w) / cell);
        const nz   = Math.max(1, Math.round((z1 - z0) / cell));
        const dz   = ((z1 - z0) / nz);
        for (let i = 0; i < nx; i++) {
            const x0 = (-w + (i * cell));
            const x1 = (x0 + cell);
            for (let k = 0; k < nz; k++) {
                const za = (z0 + (k * dz));
                const zb = (za + dz);
                b.polygon([[x0, h, za], [x0, h, zb], [x1, h, zb], [x1, h, za]], color.FLOOR_TOP);
            }
        }
    }

    // The cross marks of a tile's top between z0 and z1 (tile coordinates): painted strips of TILE_MARK_WIDTH lying
    // TILE_MARK_RAISE over it, without glow (discreet, user request).
    static _marks(b, z0, z1) {
        const mark  = LightLaneTuning.COLOR.FLOOR_MARK;
        const w     = (LightLaneTuning.LANE_WIDTH / 2);
        const y     = (LightLaneTuning.TILE_THICKNESS + LightLaneTuning.TILE_MARK_RAISE);
        const l     = (LightLaneTuning.TILE_LENGTH / 2);
        const width = LightLaneTuning.TILE_MARK_WIDTH;
        for (let z = -l; z < l; z += LightLaneTuning.TILE_MARK_STEP) {
            if ((z >= z0) && ((z + width) <= z1)) {
                b.polygon([[-w, y, z], [-w, y, (z + width)], [w, y, (z + width)], [w, y, z]], mark);
            }
        }
    }

    // Bar 1.70 × 0.25 × 0.30 on two feet 0.10 × 0.65 × 0.30; the bar's top edges and the feet's front edges in DANGER.
    static _hurdle(lineSize) {
        const color = LightLaneTuning.COLOR;
        const body  = {top: color.BODY_TOP, side: color.BODY_SIDE, bottom: color.BODY_BOTTOM};
        const d     = (LightLaneTuning.OBSTACLES.H.length / 2);
        const b     = new LightLaneObjectBuilder();
        b.box([-0.85, 0.65, -d], [0.85, 0.90, d], body);
        for (const side of [-1, 1]) {
            b.box([(side * 0.85) - 0.05, 0, -d], [(side * 0.85) + 0.05, 0.65, d], body);
            b.line([side * 0.85, 0, -d], [side * 0.85, 0.65, -d], lineSize, color.DANGER, [side, 0, -1]);
        }
        b.line([-0.85, 0.90, -d], [0.85, 0.90, -d], lineSize, color.DANGER, [0, 1, -1]);
        b.line([-0.85, 0.90, d], [0.85, 0.90, d], lineSize, color.DANGER, [0, 1, 1]);

        return b.data();
    }

    // Beam 1.90 × 0.40 × 0.30 from 1.05 to 1.45 m, posts 0.08 × 3.0 at x ±1.02 (LINE_DIM); the beam's low edges DANGER.
    static _gate(lineSize) {
        const color = LightLaneTuning.COLOR;
        const d     = (LightLaneTuning.OBSTACLES.P.length / 2);
        const b     = new LightLaneObjectBuilder();
        b.box([-0.95, 1.05, -d], [0.95, 1.45, d], {top: color.BODY_TOP, side: color.BODY_SIDE, bottom: color.BODY_BOTTOM});
        for (const side of [-1, 1]) {
            b.box([(side * 1.02) - 0.04, 0, -0.04], [(side * 1.02) + 0.04, 3.0, 0.04], {top: color.LINE_DIM, side: color.LINE_DIM, bottom: color.LINE_DIM}, true);
        }
        b.line([-0.95, 1.05, -d], [0.95, 1.05, -d], lineSize, color.DANGER, [0, -1, -1]);
        b.line([-0.95, 1.05, d], [0.95, 1.05, d], lineSize, color.DANGER, [0, -1, 1]);

        return b.data();
    }

    // A block 1.80 × 3.20 × L, its vertical corners cut at 45°; DANGER on the top edges, the front vertical edges, the
    // front bottom edge and a cross on the front face.
    static _block(length, lineSize) {
        const color = LightLaneTuning.COLOR;
        const w     = 0.90;
        const h     = 3.20;
        const c     = 0.15;
        const l     = (length / 2);
        const o     = (LightLaneTuning.LINE_OUTSET + (lineSize / 2));
        const b     = new LightLaneObjectBuilder();
        b.prism([[-w, -l + c], [-w, l - c], [-w + c, l], [w - c, l], [w, l - c], [w, -l + c], [w - c, -l], [-w + c, -l]], 0, h,
            {top: color.BODY_TOP, side: color.BODY_SIDE, bottom: color.BODY_BOTTOM});
        const line = (from, to, normal) => b.bar(from, to, lineSize, color.DANGER, normal);
        line([-w - o, h + o, -l + c], [-w - o, h + o, l - c], [-1, 1, 0]);
        line([w + o, h + o, -l + c], [w + o, h + o, l - c], [1, 1, 0]);
        line([-w + c, h + o, -l - o], [w - c, h + o, -l - o], [0, 1, -1]);
        line([-w + c, h + o, l + o], [w - c, h + o, l + o], [0, 1, 1]);
        line([-w + c, 0, -l - o], [-w + c, h, -l - o], [0, 0, -1]);
        line([w - c, 0, -l - o], [w - c, h, -l - o], [0, 0, -1]);
        line([-w + c, o, -l - o], [w - c, o, -l - o], [0, 0, -1]);
        line([-w + c, 0.1, -l - o], [w - c, h - 0.1, -l - o], [0, 0, -1]);
        line([w - c, 0.1, -l - o], [-w + c, h - 0.1, -l - o], [0, 0, -1]);

        return b.data();
    }

    // A tile with the hole of a gap (art § 5.2): the slab before and after it, the left line on both, LETHAL lines
    // across its front and back edges.
    static _gapTile(spec, decorSize, lineSize) {
        const color = LightLaneTuning.COLOR;
        const w     = (LightLaneTuning.LANE_WIDTH / 2);
        const l     = (LightLaneTuning.TILE_LENGTH / 2);
        const h     = LightLaneTuning.TILE_THICKNESS;
        const from  = (spec.holeFrom - l);
        const to    = (from + spec.length);
        const b     = new LightLaneObjectBuilder();
        for (const [z0, z1] of [[-l, from], [to, l]]) {
            LightLaneModels._slab(b, z0, z1);
            b.line([-w, h, z0], [-w, h, z1], decorSize, color.LINE_DIM);
            LightLaneModels._marks(b, z0, z1);
        }
        b.line([-w, h, from], [w, h, from], lineSize, color.LETHAL, [0, 1, 1]);
        b.line([-w, h, to], [w, h, to], lineSize, color.LETHAL, [0, 1, -1]);

        return b.data();
    }

    // An octahedron 0.22 wide, 0.32 high, its bottom at the origin, glowing COIN.
    static _coin() {
        const hw     = 0.11;
        const hh     = 0.16;
        const top    = [0, 2 * hh, 0];
        const bottom = [0, 0, 0];
        const ring   = [[hw, hh, 0], [0, hh, hw], [-hw, hh, 0], [0, hh, -hw]];
        const inside = [0, hh, 0];
        const b      = new LightLaneObjectBuilder();
        for (let i = 0; i < 4; i++) {
            const a = ring[i];
            const n = ring[(i + 1) % 4];
            b.facing([top, a, n], inside, LightLaneTuning.COLOR.COIN, true);
            b.facing([bottom, n, a], inside, LightLaneTuning.COLOR.COIN, true);
        }

        return b.data();
    }

    // A tetrahedron of SHARD_SIZE, additive and glowing, its centre at the origin.
    static _shard(rgb) {
        const s      = (LightLaneTuning.SHARD_SIZE / 2);
        const p      = [[s, s, s], [-s, -s, s], [-s, s, -s], [s, -s, -s]];
        const b      = new LightLaneObjectBuilder();
        for (const [i, j, k] of [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]]) {
            b.facing([p[i], p[j], p[k]], [0, 0, 0], rgb, true, true);
        }

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
// The slab under a celled top stops this short of it (its own top stays hidden under the cells).
LightLaneModels.TOP_INSET  = 0.001;
LightLaneModels.FAR_SUFFIX = 'Far';
LightLaneModels.TILE       = 'tile';
LightLaneModels.TILE_EDGE  = 'tileEdge';
LightLaneModels.HORIZON    = 'horizon';
LightLaneModels.RUNNER     = 'runner';
LightLaneModels.HURDLE     = 'hurdle';
LightLaneModels.GATE       = 'gate';
LightLaneModels.COIN       = 'coin';
LightLaneModels.SHARD      = 'shard';
LightLaneModels.BLOCKS     = Object.freeze(['B3', 'B6', 'B10', 'B16']);
LightLaneModels.GAPS       = Object.freeze(['X3', 'X5']);
// One shard object a colour (art § 5.2): name → palette code.
LightLaneModels.SHARD_COLORS = Object.freeze({Player: 'PLAYER', Danger: 'DANGER'});
