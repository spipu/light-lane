/**
 * The objects built in code (art § 5.2), as Object3dLoader data, and the runner's glTF: loaded inside the loader batch
 * of the run, kept by code. Origin of an object: the centre of its bottom, its front towards −z; a face that glows
 * says so in its data (glow: true). Every object with lines has a far variant (code + LightLaneModels.FAR_SUFFIX) with
 * thicker lines (art § 4). Built with LightLaneObjectBuilder.
 */
class LightLaneModels {
    /**
     * Inside the loader batch.
     *
     * @param {boolean} lod - the tiles' tops coloured by level of detail (the test mode's `lod`)
     */
    static load(lod = false) {
        LightLaneModels.CODES.length = 0;
        LightLaneModels._lod = lod;
        const color = LightLaneTuning.COLOR;
        const decor = [LightLaneTuning.LINE_SIZE_DECOR, LightLaneTuning.LINE_SIZE_DECOR_FAR];
        [false, true].forEach((far, i) => {
            const suffix = ((far) ? LightLaneModels.FAR_SUFFIX : '');
            LightLaneModels._load(LightLaneModels.TILE + suffix, LightLaneModels._tile(decor[i], null));
            LightLaneModels._load(LightLaneModels.ROW3 + suffix, LightLaneModels._tile(decor[i], null, LightLaneTuning.LANES_3.length));
            LightLaneModels._load(LightLaneModels.TILE_EDGE + suffix, LightLaneModels._tileEdge(decor[i]));
        });
        const lines = [LightLaneTuning.LINE_SIZE, LightLaneTuning.LINE_SIZE_FAR];
        [false, true].forEach((far, i) => {
            const suffix = ((far) ? LightLaneModels.FAR_SUFFIX : '');
            LightLaneModels._load(LightLaneModels.HURDLE + suffix, LightLaneModels._hurdle(lines[i]));
            LightLaneModels._load(LightLaneModels.GATE + suffix, LightLaneModels._gate(lines[i]));
            for (const code of LightLaneModels.BLOCKS) {
                LightLaneModels._load(LightLaneModels.blockCode(code) + suffix, LightLaneModels._block(LightLaneTuning.OBSTACLES[code].length, lines[i]));
            }
            for (const code of LightLaneModels.GAPS) {
                LightLaneModels._load(LightLaneModels.gapTileCode(code) + suffix, LightLaneModels._gapTile(LightLaneTuning.OBSTACLES[code], decor[i], lines[i], null));
            }
        });
        LightLaneModels._load(LightLaneModels.COIN, LightLaneModels._coin());
        for (const [name, rgb] of Object.entries(LightLaneModels.SHARD_COLORS)) {
            LightLaneModels._load(LightLaneModels.SHARD + name, LightLaneModels._shard(color[rgb]));
        }
        // Under the runner's light, by half tile (a mark every half tile shows it as a row): the half the runner is on
        // in fine cells, the next half in coarser cells; holed tiles too (a gap is often met right under the light).
        for (const [suffix, cells] of Object.entries(LightLaneModels.LIT_LEVELS)) {
            LightLaneModels._load(LightLaneModels.TILE + suffix, LightLaneModels._tile(LightLaneTuning.LINE_SIZE_DECOR, cells));
            LightLaneModels._load(LightLaneModels.ROW3 + suffix, LightLaneModels._tile(LightLaneTuning.LINE_SIZE_DECOR, cells, LightLaneTuning.LANES_3.length));
            for (const code of LightLaneModels.GAPS) {
                LightLaneModels._load(LightLaneModels.gapTileCode(code) + suffix, LightLaneModels._gapTile(LightLaneTuning.OBSTACLES[code], LightLaneTuning.LINE_SIZE_DECOR, LightLaneTuning.LINE_SIZE, cells));
            }
        }
        LightLaneModels._load(LightLaneModels.BACKDROP, LightLaneModels._backdrop());
        loader.animatedModels().loadByCode(LightLaneModels.RUNNER, LightLaneModels.ASSETS + 'models/runner.gltf');
    }

    /**
     * Once loaded: every object built here gets its light group's factor (LIGHT_COMPENSATION: its look kept under the
     * ambient lowered for the runner's light).
     */
    static compensate() {
        for (const code of LightLaneModels.CODES) {
            loader.objects().getByCode(code).setGroupLightFactor(LightLaneObjectBuilder.LIGHT_GROUP, LightLaneTuning.LIGHT_COMPENSATION);
        }
    }

    static _load(code, data) {
        LightLaneModels.CODES.push(code);

        return loader.objects().loadFromData(code, data);
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
    static _tile(lineSize, cells, lanes = 1) {
        const color = LightLaneTuning.COLOR;
        const w     = ((lanes * LightLaneTuning.LANE_WIDTH) / 2);
        const l     = (LightLaneTuning.TILE_LENGTH / 2);
        const h     = LightLaneTuning.TILE_THICKNESS;
        const b     = new LightLaneObjectBuilder();
        LightLaneModels._slab(b, -l, l, cells, false, w);
        // The left line of each lane; a whole row has the right edge's too.
        for (let k = 0; k < lanes; k++) {
            const x = (-w + (k * LightLaneTuning.LANE_WIDTH));
            b.line([x, h, -l], [x, h, l], lineSize, color.LINE_DIM, [((k === 0) ? -1 : 0), 1, 0]);
        }
        if (lanes > 1) {
            b.line([w, h, -l], [w, h, l], lineSize, color.LINE_DIM, [1, 1, 0]);
        }
        LightLaneModels._marks(b, -l, l, w);

        return b.data();
    }

    // A slab of a tile from z0 to z1, its top only, without the faces the camera never sees: no bottom, no sides, no
    // back (it faces away from a camera looking ahead); a front only where nothing lies before it (a gap's far wall). Near the runner's light,
    // each half of its top may be cut in cells (`cells`: [first half, second half], metres or null) so the light,
    // computed at the vertices, shows on it.
    static _slab(b, z0, z1, cells = null, front = false, halfWidth = (LightLaneTuning.LANE_WIDTH / 2)) {
        const color = LightLaneTuning.COLOR;
        const w     = halfWidth;
        const h     = LightLaneTuning.TILE_THICKNESS;
        // No side faces (user request, seen in wireframe): between lanes nothing shows them, and the camera, inside the
        // track, never sees its outer sides.
        if (front) {
            b.rect(-w, 0, w, h, z0, color.BODY_SIDE);
        }
        b.setFloor(true);
        // The top, half by half of the tile (its first half before z = 0, its second after), each plain or in cells.
        for (const [half, from, to] of [[0, z0, Math.min(z1, 0)], [1, Math.max(z0, 0), z1]]) {
            if (to <= from) {
                continue;
            }
            const cell = ((cells === null) ? null : cells[half]);
            const top  = LightLaneModels._topColor(cell);
            if (cell === null) {
                b.polygon([[-w, h, from], [-w, h, to], [w, h, to], [w, h, from]], top);
                continue;
            }
            const nx = Math.round((2 * w) / cell);
            const nz = Math.max(1, Math.round((to - from) / cell));
            const dz = ((to - from) / nz);
            for (let i = 0; i < nx; i++) {
                const x0 = (-w + (i * cell));
                const x1 = (x0 + cell);
                for (let k = 0; k < nz; k++) {
                    const za = (from + (k * dz));
                    const zb = (za + dz);
                    b.polygon([[x0, h, za], [x0, h, zb], [x1, h, zb], [x1, h, za]], top);
                }
            }
        }
        b.setFloor(false);
    }

    // The colour of a tile's top: FLOOR_TOP, or under the test mode's `lod` the colour of its level (cell size).
    static _topColor(cell) {
        if (!LightLaneModels._lod) {
            return LightLaneTuning.COLOR.FLOOR_TOP;
        }
        const colors = LightLaneTuning.LOD_COLORS;

        return ((cell === null) ? colors.plain : ((cell === LightLaneTuning.TILE_TOP_CELL) ? colors.fine : colors.mid));
    }

    // The cross marks of a tile's top between z0 and z1 (tile coordinates): painted strips of TILE_MARK_WIDTH lying
    // TILE_MARK_RAISE over it, without glow (discreet, user request).
    static _marks(b, z0, z1, halfWidth = (LightLaneTuning.LANE_WIDTH / 2)) {
        const mark  = LightLaneTuning.COLOR.FLOOR_MARK;
        const w     = halfWidth;
        const y     = (LightLaneTuning.TILE_THICKNESS + LightLaneTuning.TILE_MARK_RAISE);
        const l     = (LightLaneTuning.TILE_LENGTH / 2);
        const width = LightLaneTuning.TILE_MARK_WIDTH;
        // Painted on the floor: lit by the runner's light as the floor is.
        b.setFloor(true);
        for (let z = -l; z < l; z += LightLaneTuning.TILE_MARK_STEP) {
            if ((z >= z0) && ((z + width) <= z1)) {
                b.polygon([[-w, y, z], [-w, y, (z + width)], [w, y, (z + width)], [w, y, z]], mark);
            }
        }
        b.setFloor(false);
    }

    // Bar 1.70 × 0.25 × 0.30 from 0.65 to 0.90 m on two feet 0.10 wide at x ±0.85, drawn by its lines only (user
    // request: no dark faces one hardly sees): the bar's four long edges and the feet's front edges in DANGER.
    static _hurdle(lineSize) {
        const color = LightLaneTuning.COLOR;
        const d     = (LightLaneTuning.OBSTACLES.H.length / 2);
        const b     = new LightLaneObjectBuilder();
        for (const side of [-1, 1]) {
            b.line([side * 0.85, 0, -d], [side * 0.85, 0.65, -d], lineSize, color.DANGER, [side, 0, -1]);
        }
        for (const [y, up] of [[0.90, 1], [0.65, -1]]) {
            b.line([-0.85, y, -d], [0.85, y, -d], lineSize, color.DANGER, [0, up, -1]);
            b.line([-0.85, y, d], [0.85, y, d], lineSize, color.DANGER, [0, up, 1]);
        }
        // No way under it: a red cross between its feet, under the bar.
        LightLaneModels._cross(b, -0.70, 0.08, 0.70, 0.58, -d, lineSize);

        return b.data();
    }

    // Beam 1.90 × 0.40 × 0.30 from 1.05 to 1.45 m, drawn by its lines only (user request: no dark faces one hardly
    // sees): its four long edges in DANGER; posts 0.08 × 3.0 at x ±1.02 in LINE_DIM.
    static _gate(lineSize) {
        const color = LightLaneTuning.COLOR;
        const d     = (LightLaneTuning.OBSTACLES.P.length / 2);
        const b     = new LightLaneObjectBuilder();
        for (const side of [-1, 1]) {
            b.box([(side * 1.02) - 0.04, 0, -0.04], [(side * 1.02) + 0.04, 3.0, 0.04], {top: color.LINE_DIM, side: color.LINE_DIM, bottom: null}, true);
        }
        for (const [y, up] of [[1.05, -1], [1.45, 1]]) {
            b.line([-0.95, y, -d], [0.95, y, -d], lineSize, color.DANGER, [0, up, -1]);
            b.line([-0.95, y, d], [0.95, y, d], lineSize, color.DANGER, [0, up, 1]);
        }
        // No way over it: a red cross between its posts, above the beam.
        LightLaneModels._cross(b, -0.85, 1.60, 0.85, 2.85, -d, lineSize);

        return b.data();
    }

    // A red cross (LETHAL, glowing) in the plane z, over the rectangle (x0, y0) – (x1, y1): the way that is closed
    // (user request: one did not see where an obstacle cannot be passed).
    static _cross(b, x0, y0, x1, y1, z, lineSize) {
        const at = (z - LightLaneTuning.LINE_OUTSET - (lineSize / 2));
        b.bar([x0, y0, at], [x1, y1, at], lineSize, LightLaneTuning.COLOR.LETHAL, [0, 0, -1]);
        b.bar([x1, y0, at], [x0, y1, at], lineSize, LightLaneTuning.COLOR.LETHAL, [0, 0, -1]);
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
            {top: color.BODY_TOP, side: color.BODY_SIDE, bottom: null});
        const line = (from, to, normal) => b.bar(from, to, lineSize, color.DANGER, normal);
        line([-w - o, h + o, -l + c], [-w - o, h + o, l - c], [-1, 1, 0]);
        line([w + o, h + o, -l + c], [w + o, h + o, l - c], [1, 1, 0]);
        line([-w + c, h + o, -l - o], [w - c, h + o, -l - o], [0, 1, -1]);
        line([-w + c, h + o, l + o], [w - c, h + o, l + o], [0, 1, 1]);
        line([-w + c, 0, -l - o], [-w + c, h, -l - o], [0, 0, -1]);
        line([w - c, 0, -l - o], [w - c, h, -l - o], [0, 0, -1]);
        line([-w + c, o, -l - o], [w - c, o, -l - o], [0, 0, -1]);
        // Neither over nor under it: its front cross in red.
        LightLaneModels._cross(b, (-w + c), 0.1, (w - c), (h - 0.1), -l, lineSize);

        return b.data();
    }

    // A tile with the hole of a gap (art § 5.2): the slab before and after it, the left line on both, LETHAL lines
    // across its front and back edges.
    static _gapTile(spec, decorSize, lineSize, cells) {
        const color = LightLaneTuning.COLOR;
        const w     = (LightLaneTuning.LANE_WIDTH / 2);
        const l     = (LightLaneTuning.TILE_LENGTH / 2);
        const h     = LightLaneTuning.TILE_THICKNESS;
        const from  = (spec.holeFrom - l);
        const to    = (from + spec.length);
        const b     = new LightLaneObjectBuilder();
        for (const [z0, z1] of [[-l, from], [to, l]]) {
            // The slab after the hole shows its front: the gap's far wall.
            LightLaneModels._slab(b, z0, z1, cells, (z0 === to));
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

    // The backdrop (user requests, after their reference picture): a blue haze over the horizon, the horizon band at
    // the ground's level, a lone spire on the track's axis on a stepped base, towers in pairs on both sides, a low
    // skyline along the rest; dark silhouettes edged with dim lines, the spire's tip glowing. Flat, facing the camera;
    // built at the scale BACKDROP_NEAR / BACKDROP_DISTANCE (LightLaneTuning).
    static _backdrop() {
        const color  = LightLaneTuning.COLOR;
        const k      = (LightLaneTuning.BACKDROP_NEAR / LightLaneTuning.BACKDROP_DISTANCE);
        const r      = (v) => (v * k);
        const random = new LightLaneRandom(LightLaneTuning.CITY_SEED);
        const b      = new LightLaneObjectBuilder();
        const half   = LightLaneTuning.BACKDROP_HALF;
        const edge   = LightLaneTuning.CITY_EDGE;
        const lift   = LightLanePresentation.BACKDROP_LINE_LIFT;
        // Layers, nearest first: the band, the city's lines, its silhouettes, the haze behind all.
        const city   = r(LightLanePresentation.BACKDROP_LAYER);
        const haze   = r(2 * LightLanePresentation.BACKDROP_LAYER);
        for (const [height, rgb] of LightLaneTuning.CITY_HAZE) {
            b.polygon([[r(-half), 0, haze], [r(-half), r(height), haze], [r(half), r(height), haze], [r(half), 0, haze]], rgb, false, true);
        }
        b.rect(r(-half), 0, r(half), r(LightLaneTuning.HORIZON_BAND), 0, color.HORIZON, true);
        // A silhouette: a dark polygon of the facade, its outline in dim lines (each edge a thin strip).
        const shape = (outline, line) => {
            b.polygon(outline.map(([x, y]) => [r(x), r(y), city]), color.BODY_BOTTOM);
            for (let i = 0; i < outline.length; i++) {
                const [xa, ya] = outline[i];
                const [xb, yb] = outline[(i + 1) % outline.length];
                if ((ya === 0) && (yb === 0)) {
                    continue;
                }
                const len = Math.hypot((xb - xa), (yb - ya));
                const nx  = (-(yb - ya) / len) * (edge / 2);
                const ny  = ((xb - xa) / len) * (edge / 2);
                // Turned towards the camera (−z), whatever the edge's direction.
                b.facing([[r(xa - nx), r(ya - ny), city - lift], [r(xa + nx), r(ya + ny), city - lift], [r(xb + nx), r(yb + ny), city - lift], [r(xb - nx), r(yb - ny), city - lift]],
                    [r(xa), r(ya), (city + 1)], line, true);
            }
        };
        const box = (x0, x1, height, line) => shape([[x0, 0], [x0, height], [x1, height], [x1, 0]], line);
        // The spire: a tapering needle on a stepped base, its tip glowing.
        const spire = LightLaneTuning.CITY_SPIRE;
        for (const [width, height] of spire.steps) {
            box(-width / 2, width / 2, height, LightLaneTuning.CITY_LINE);
        }
        shape([[-spire.base / 2, 0], [-spire.tip / 2, spire.height], [spire.tip / 2, spire.height], [spire.base / 2, 0]], LightLaneTuning.CITY_LINE);
        b.rect(r(-spire.tip), r(spire.height - 0.6), r(spire.tip), r(spire.height + 0.4), (city - (2 * lift)), LightLaneTuning.CITY_TIP, true);
        // Towers in pairs.
        for (const [x, width, height] of LightLaneTuning.CITY_TOWERS) {
            for (const side of [-1, 1]) {
                const centre = (side * x);
                box(centre - (width / 2), centre + (width / 2), height, LightLaneTuning.CITY_LINE);
            }
        }
        // The low skyline, on both sides from CITY_LOW_FROM out.
        for (const side of [-1, 1]) {
            let x = LightLaneTuning.CITY_LOW_FROM;
            while (x < half) {
                const width  = random.between(...LightLaneTuning.CITY_LOW_WIDTH);
                const height = random.between(...LightLaneTuning.CITY_LOW_HEIGHT);
                const x1     = Math.min(half, (x + width));
                box(Math.min(side * x, side * x1), Math.max(side * x, side * x1), height, LightLaneTuning.CITY_LINE);
                x = (x1 + random.between(...LightLaneTuning.CITY_LOW_GAP));
            }
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
LightLaneModels.FAR_SUFFIX = 'Far';
LightLaneModels._lod       = false;
// The codes of the objects built here (load()).
LightLaneModels.CODES      = [];
// Levels of a tile under the runner's light, by half: F fine (TILE_TOP_CELL), M coarser (TILE_MID_CELL), P plain; the
// variants a run needs (the fine halves: those the light reaches and the camera sees, one or two; then one coarser).
LightLaneModels.LIT_LEVELS = Object.freeze({
    FF: Object.freeze([LightLaneTuning.TILE_TOP_CELL, LightLaneTuning.TILE_TOP_CELL]),
    FM: Object.freeze([LightLaneTuning.TILE_TOP_CELL, LightLaneTuning.TILE_MID_CELL]),
    MP: Object.freeze([LightLaneTuning.TILE_MID_CELL, null]),
    PF: Object.freeze([null, LightLaneTuning.TILE_TOP_CELL]),
});
LightLaneModels.TILE       = 'tile';
LightLaneModels.TILE_EDGE  = 'tileEdge';
// A whole row of 3 lanes in one tile (user request: no separation between lanes but at a gap).
LightLaneModels.ROW3       = 'row3';
LightLaneModels.BACKDROP   = 'backdrop';
LightLaneModels.RUNNER     = 'runner';
LightLaneModels.HURDLE     = 'hurdle';
LightLaneModels.GATE       = 'gate';
LightLaneModels.COIN       = 'coin';
LightLaneModels.SHARD      = 'shard';
LightLaneModels.BLOCKS     = Object.freeze(['B3', 'B6', 'B10', 'B16']);
LightLaneModels.GAPS       = Object.freeze(['X3', 'X5']);
// One shard object a colour (art § 5.2): name → palette code.
LightLaneModels.SHARD_COLORS = Object.freeze({Player: 'PLAYER', Danger: 'DANGER'});
