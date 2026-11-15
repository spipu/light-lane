/**
 * The objects built in code (art § 5.2), as Object3dLoader data, and the runner's glTF: loaded inside the loader batch
 * of the run, kept by code. Origin of an object: the centre of its bottom, its front towards −z; a face that glows
 * says so in its data (glow: true). Lines keep one size at any distance (user requests): the bloom's halo, kept whole
 * far away, shows them. Built with LightLaneObjectBuilder.
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
        // The track's tiles (plain, holed, whole rows), each plain and in the levels of detail under the runner's light
        // (by half tile, a mark every half tile shows it as a row; holed tiles too, a gap is often met right under the
        // light); one size of lines at any distance (user request). A hole's side walls, the right edge, the warning
        // zone's red edges and chevrons are instances of their own beside the tiles.
        for (const [suffix, cells] of [['', null], ...Object.entries(LightLaneModels.LIT_LEVELS)]) {
            for (const [code, build] of LightLaneModels._tileBuilders()) {
                LightLaneModels._load(code + suffix, build(cells));
            }
        }
        LightLaneModels._load(LightLaneModels.TILE_EDGE, LightLaneModels._tileEdge(LightLaneTuning.LINE_SIZE_DECOR, null));
        for (const code of LightLaneModels.GAPS) {
            LightLaneModels._load(LightLaneModels.tileEdgeCode(code), LightLaneModels._tileEdge(LightLaneTuning.LINE_SIZE_DECOR, code));
        }
        for (const [code, side, z0, z1] of LightLaneModels._wallSpans()) {
            LightLaneModels._load(code, LightLaneModels._holeWall(side, z0, z1));
        }
        LightLaneModels._load(LightLaneModels.WARN_EDGES, LightLaneModels._warnEdges());
        for (const [suffix, side] of LightLaneModels.ARROW_SIDES) {
            LightLaneModels._load(LightLaneModels.ARROW + suffix, LightLaneModels._arrow(side, LightLaneTuning.ARROW_SIZE));
            LightLaneModels._load(LightLaneModels.STALKER_ARROW + suffix, LightLaneModels._arrow(side, LightLaneTuning.STALKER_ARROW_SIZE));
        }
        // The enemies (gameplay § 6) and the Sentinel's shapes and shots (§ 7).
        LightLaneModels._load(LightLaneModels.PROWLER, LightLaneModels._enemy(0, false));
        for (const [suffix, side] of LightLaneModels.ARROW_SIDES) {
            LightLaneModels._load(LightLaneModels.STALKER + suffix, LightLaneModels._enemy(side, false));
            LightLaneModels._load(LightLaneModels.STALKER + suffix + LightLaneModels.WARN, LightLaneModels._enemy(side, true));
        }
        for (let band = 0; band < LightLaneTuning.TRAIL_BANDS; band++) {
            for (const length of [LightLaneTuning.TRAIL_PIECE_LONG, LightLaneTuning.TRAIL_PIECE_SHORT]) {
                LightLaneModels._load(LightLaneModels.trailCode(band, length), LightLaneModels._trailWall(length, [LightLaneTuning.TRAIL_FADE[band]]));
            }
        }
        // The tail with the rounded end: whole (a straight run), and slice by slice (a curve).
        const tail = [...Array(LightLaneTuning.TRAIL_TAIL_SLICES).keys()].map(() => LightLaneTuning.TRAIL_FADE[LightLaneTuning.TRAIL_BANDS - 1]);
        const slice = (LightLaneTuning.TRAIL_TAIL / LightLaneTuning.TRAIL_TAIL_SLICES);
        LightLaneModels._load(LightLaneModels.TRAIL_TAIL, LightLaneModels._trailWall(LightLaneTuning.TRAIL_TAIL, tail, 0));
        tail.forEach((fade, k) => {
            LightLaneModels._load(LightLaneModels.TRAIL_TAIL + k, LightLaneModels._trailWall(slice, [fade], ((tail.length - 1 - k) * slice)));
        });
        LightLaneModels._load(LightLaneModels.SENTINEL, LightLaneModels._sentinel(color.WARN));
        LightLaneModels._load(LightLaneModels.SENTINEL_STRIKE, LightLaneModels._sentinel(color.LETHAL));
        LightLaneTuning.STRIKE_WIDTHS.forEach((width, i) => {
            LightLaneModels._load(LightLaneModels.STRIKE_MARK + (i + 1), LightLaneModels._strikeMark(width));
        });
        LightLaneModels._load(LightLaneModels.STRIKE_BEAM, LightLaneModels._strikeBeam());
        LightLaneTuning.SWEEP_WIDTH.forEach((width, i) => {
            for (const height of Object.keys(LightLaneTuning.SWEEP_DRAWN)) {
                LightLaneModels._load(LightLaneModels.sweepCode(true, i, height), LightLaneModels._sweepFrame(width, LightLaneTuning.SWEEP_DRAWN[height]));
                LightLaneModels._load(LightLaneModels.sweepCode(false, i, height), LightLaneModels._sweepRay(width, LightLaneTuning.SWEEP_DRAWN[height]));
            }
        });
        // The obstacles: one size of lines at any distance (user request: no sudden change as they come near; the
        // bloom's halo keeps them visible far away).
        const line = LightLaneTuning.LINE_SIZE;
        LightLaneModels._load(LightLaneModels.HURDLE, LightLaneModels._hurdle(line));
        LightLaneModels._load(LightLaneModels.GATE, LightLaneModels._gate(line));
        for (const code of LightLaneModels.BLOCKS) {
            // Two variants: the side crosses on the left or on the right, the side the camera sees (presentation).
            for (const [suffix, side] of LightLaneModels.BLOCK_SIDES) {
                LightLaneModels._load(LightLaneModels.blockCode(code) + suffix, LightLaneModels._block(LightLaneTuning.OBSTACLES[code].length, line, side));
            }
        }
        LightLaneModels._load(LightLaneModels.COIN, LightLaneModels._coin());
        for (const [name, rgb] of Object.entries(LightLaneModels.SHARD_COLORS)) {
            LightLaneModels._load(LightLaneModels.SHARD + name, LightLaneModels._shard(color[rgb]));
        }
        LightLaneModels._load(LightLaneModels.FOG, LightLaneModels._fog());
        LightLaneModels._skyId = loader.textures().load(LightLaneModels.ASSETS + LightLaneTuning.SKY_URL);
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
     * @returns {int} the texture id of the background picture
     */
    static skyId() {
        return LightLaneModels._skyId;
    }

    /**
     * @param {string} code - B3, B6, B10, B16
     * @returns {string} the code of its object
     */
    static blockCode(code) {
        return LightLaneModels.BLOCK_CODES[code];
    }

    /**
     * @param {string} code - B3, B6, B10, B16
     * @param {int}    side - the side its crosses show: −1 left, +1 right
     * @returns {string} the code of its object with those crosses (read from a table: no string built a frame)
     */
    static blockSideCode(code, side) {
        return LightLaneModels.BLOCK_SIDE_CODES[code][(side < 0) ? 0 : 1];
    }

    /**
     * @param {string} code - X3, X5
     * @returns {string} the code of the tile holed for it
     */
    static gapTileCode(code) {
        return ('tileGap' + code.slice(1));
    }

    /**
     * @param {string} code - X3, X5: the gap of the rightmost lane
     * @returns {string} the code of the right edge line cut at its hole
     */
    static tileEdgeCode(code) {
        return (LightLaneModels.TILE_EDGE + code.slice(1));
    }

    // The tiles each level of detail is built for: [code, build(cells)].
    static _tileBuilders() {
        const line = LightLaneTuning.LINE_SIZE_DECOR;
        const list = [
            [LightLaneModels.TILE, (cells) => LightLaneModels._tile(line, cells)],
            [LightLaneModels.TILE_FRONT, (cells) => LightLaneModels._tile(line, cells, 1, true)],
            [LightLaneModels.ROW3, (cells) => LightLaneModels._tile(line, cells, LightLaneTuning.LANES_3.length)],
            [LightLaneModels.ROW5, (cells) => LightLaneModels._tile(line, cells, LightLaneTuning.LANES_5.length)],
        ];
        for (const code of LightLaneModels.GAPS) {
            list.push([LightLaneModels.gapTileCode(code), (cells) => LightLaneModels._gapTile(LightLaneTuning.OBSTACLES[code], line, LightLaneTuning.LINE_SIZE, cells)]);
        }

        return list;
    }

    /**
     * The side walls a holed tile needs where a neighbour lane's top flanks its hole: a plain tile beside it, all of
     * the hole; a holed tile, what its own hole leaves; none at the track's edge.
     *
     * @param {string}      code      - X3, X5
     * @param {int}         side      - −1 left, +1 right
     * @param {string|null} neighbour - the side lane's code (TILE or a gap's), null where no lane is
     * @returns {string[]} the codes of the wall objects, each placed at the lane's side (x ± LANE_WIDTH / 2)
     */
    static holeWalls(code, side, neighbour) {
        const suffix = ((side < 0) ? LightLaneModels.WALL_SIDES[0][0] : LightLaneModels.WALL_SIDES[1][0]);

        return LightLaneModels._walls(code, neighbour).map(([z0, z1]) => LightLaneModels._wallCode(suffix, z0, z1));
    }

    static _wallCode(suffix, z0, z1) {
        return (LightLaneModels.HOLE_WALL + suffix + z0.toFixed(1) + '_' + z1.toFixed(1));
    }

    // Every wall span a hole can need, on both sides: [code, side, z0, z1].
    static _wallSpans() {
        const spans = new Map();
        for (const code of LightLaneModels.GAPS) {
            for (const neighbour of [LightLaneModels.TILE, ...LightLaneModels.GAPS]) {
                for (const [z0, z1] of LightLaneModels._walls(code, neighbour)) {
                    for (const [suffix, side] of LightLaneModels.WALL_SIDES) {
                        spans.set(LightLaneModels._wallCode(suffix, z0, z1), [side, z0, z1]);
                    }
                }
            }
        }

        return [...spans].map(([code, [side, z0, z1]]) => [code, side, z0, z1]);
    }

    /**
     * @param {string}      code      - the holed tile's gap
     * @param {string|null} neighbour - the side lane's code, null at the track's edge
     * @returns {number[][]} the [z0, z1] spans (tile frame) of the hole the neighbour's top still covers
     */
    static _walls(code, neighbour) {
        if (neighbour === null) {
            return [];
        }
        const [from, to] = LightLaneModels._hole(code);
        if (neighbour === LightLaneModels.TILE) {
            return [[from, to]];
        }
        const [otherFrom, otherTo] = LightLaneModels._hole(neighbour);
        const spans = [[from, Math.min(to, otherFrom)], [Math.max(from, otherTo), to]];

        return spans.filter(([z0, z1]) => ((z1 - z0) > LightLaneModels.EPSILON));
    }

    // The hole of a gap's tile, [from, to] in the tile's frame (z from -TILE_LENGTH / 2).
    static _hole(code) {
        const spec = LightLaneTuning.OBSTACLES[code];
        const from = (spec.holeFrom - (LightLaneTuning.TILE_LENGTH / 2));

        return [from, (from + spec.length)];
    }

    /**
     * @param {int}    band   - 0 the nearest the bike (the brightest) to TRAIL_BANDS − 1
     * @param {number} length - TRAIL_PIECE_LONG or TRAIL_PIECE_SHORT
     * @returns {string} the code of a piece of a bike's trail
     */
    static trailCode(band, length) {
        return LightLaneModels.TRAIL_CODES[band][(length === LightLaneTuning.TRAIL_PIECE_LONG) ? 0 : 1];
    }

    /**
     * @param {int} slice - 0 to TRAIL_TAIL_SLICES − 1
     * @returns {string} the code of a slice of a trail's tail
     */
    static trailTailCode(slice) {
        return LightLaneModels.TRAIL_TAIL_CODES[slice];
    }

    /**
     * @param {boolean} warning - the frame that announces it, else the ray
     * @param {int}     wide    - 0: 3 lanes, 1: 5 lanes
     * @param {string}  height  - 'low' or 'high' (SWEEP_DRAWN key)
     * @returns {string} the code of a sweep's object
     */
    static sweepCode(warning, wide, height) {
        return (((warning) ? LightLaneModels.SWEEP_WARN : LightLaneModels.SWEEP) + LightLaneModels.SWEEP_LANES[wide] + height);
    }

    /**
     * @param {LightLaneEntity} entity - an obstacle
     * @param {boolean}         blink  - the warnings' blink is on (a stalker announcing its move)
     * @returns {string|null} the code of its object, null for a gap (drawn as its holed tile) or a bonus (step 12)
     */
    static obstacleCode(entity, blink = true) {
        switch (entity.getKind()) {
            case LightLaneEntity.HURDLE:
                return LightLaneModels.HURDLE;
            case LightLaneEntity.GATE:
                return LightLaneModels.GATE;
            case LightLaneEntity.BLOCK:
                return LightLaneModels.blockCode(entity.getCode());
            case LightLaneEntity.COIN:
                return LightLaneModels.COIN;
            case LightLaneEntity.PROWLER:
                return LightLaneModels.PROWLER;
            case LightLaneEntity.STALKER:
                return LightLaneModels.STALKER_CODES[(entity.getToLane() < entity.getLane()) ? 0 : 1][(entity.isWarning() && blink) ? 1 : 0];
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

    // A lane's tile (or a whole row's, `lanes` wide): a slab, its top at the origin's height + TILE_THICKNESS, a line
    // along its top left edge, cross lines every TILE_MARK_STEP from its start (they show the speed); `front`: its front
    // face shows (an outer lane that starts, 3 → 5 lanes).
    static _tile(lineSize, cells, lanes = 1, front = false) {
        const color = LightLaneTuning.COLOR;
        const w     = ((lanes * LightLaneTuning.LANE_WIDTH) / 2);
        const l     = (LightLaneTuning.TILE_LENGTH / 2);
        const h     = LightLaneTuning.TILE_THICKNESS;
        const b     = new LightLaneObjectBuilder();
        LightLaneModels._slab(b, -l, l, cells, front, w);
        // The left line of each lane; a whole row has the right edge's too.
        for (let k = 0; k < lanes; k++) {
            const x = (-w + (k * LightLaneTuning.LANE_WIDTH));
            b.line([x, h, -l], [x, h, l], lineSize, color.LINE_DIM, [((k === 0) ? -1 : 0), 1, 0], true);
        }
        if (lanes > 1) {
            b.line([w, h, -l], [w, h, l], lineSize, color.LINE_DIM, [1, 1, 0], true);
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
            b.rect(-w, 0, w, h, z0, LightLaneModels._glass(color.BODY_SIDE));
        }
        b.setFloor(true);
        // The top, half by half of the tile (its first half before z = 0, its second after), each plain or in cells.
        for (const [half, start, to] of [[0, z0, Math.min(z1, 0)], [1, Math.max(z0, 0), z1]]) {
            // A floor mark starting the half is left out of the top: an opaque strip beside it, never over a see-through
            // face (user request: the marks are not see-through).
            const from = ((LightLaneModels._markAt(start, z0, z1)) ? (start + LightLaneTuning.TILE_MARK_WIDTH) : start);
            if (to <= from) {
                continue;
            }
            const cell = ((cells === null) ? null : cells[half]);
            const top  = LightLaneModels._glass(LightLaneModels._topColor(cell));
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
    // The tiles' faces only, seen through a little (user request): not their lines, marks or crosses.
    static _glass(rgb) {
        return [...rgb, LightLaneTuning.TILE_ALPHA];
    }

    static _topColor(cell) {
        if (!LightLaneModels._lod) {
            return LightLaneTuning.COLOR.FLOOR_TOP;
        }
        const colors = LightLaneTuning.LOD_COLORS;

        return ((cell === null) ? colors.plain : ((cell === LightLaneTuning.TILE_TOP_CELL) ? colors.fine : colors.mid));
    }

    // A floor mark starts at z (every TILE_MARK_STEP from the tile's start) and fits in [z0, z1].
    static _markAt(z, z0, z1) {
        const step = ((z + (LightLaneTuning.TILE_LENGTH / 2)) / LightLaneTuning.TILE_MARK_STEP);

        return ((Math.abs(step - Math.round(step)) < LightLaneModels.EPSILON) && (z >= z0) && ((z + LightLaneTuning.TILE_MARK_WIDTH) <= z1));
    }

    // The cross marks of a tile's top between z0 and z1 (tile coordinates): opaque painted strips of TILE_MARK_WIDTH in
    // the top's level, which leaves them out, without glow (discreet, user request).
    static _marks(b, z0, z1, halfWidth = (LightLaneTuning.LANE_WIDTH / 2)) {
        const mark  = LightLaneTuning.COLOR.FLOOR_MARK;
        const w     = halfWidth;
        const y     = LightLaneTuning.TILE_THICKNESS;
        const l     = (LightLaneTuning.TILE_LENGTH / 2);
        const width = LightLaneTuning.TILE_MARK_WIDTH;
        // Painted on the floor: lit by the runner's light as the floor is; in the top's level, the top cut around it.
        b.setFloor(true);
        for (let z = -l; z < l; z += LightLaneTuning.TILE_MARK_STEP) {
            if (LightLaneModels._markAt(z, z0, z1)) {
                b.polygon([[-w, y, z], [-w, y, (z + width)], [w, y, (z + width)], [w, y, z]], mark);
            }
        }
        b.setFloor(false);
    }

    // Bar 1.70 × 0.25 × 0.30 from 0.65 to 0.90 m on two feet 0.10 wide at x ±0.85, drawn by its lines only (user
    // request: no dark faces one hardly sees): the bar's four long edges and the feet's front edges in DANGER.
    static _hurdle(lineSize) {
        const color = LightLaneTuning.COLOR;
        const shape = LightLaneTuning.SHAPES.HURDLE;
        const w     = shape.halfWidth;
        const d     = (LightLaneTuning.OBSTACLES.H.length / 2);
        const b     = new LightLaneObjectBuilder();
        for (const side of [-1, 1]) {
            b.line([side * w, 0, -d], [side * w, shape.barBottom, -d], lineSize, color.DANGER, [side, 0, -1]);
        }
        for (const [y, up] of [[shape.barTop, 1], [shape.barBottom, -1]]) {
            b.line([-w, y, -d], [w, y, -d], lineSize, color.DANGER, [0, up, -1]);
            b.line([-w, y, d], [w, y, d], lineSize, color.DANGER, [0, up, 1]);
        }
        // No way under it: a red cross between its feet, under the bar.
        LightLaneModels._cross(b, ...shape.cross, -d, lineSize);

        return b.data();
    }

    // Beam 1.90 × 0.40 × 0.30 from 1.05 to 1.45 m, drawn by its lines only (user request: no dark faces one hardly
    // sees): its four long edges in DANGER; posts 0.08 × 3.0 at x ±1.02 in LINE_DIM.
    static _gate(lineSize) {
        const color = LightLaneTuning.COLOR;
        const shape = LightLaneTuning.SHAPES.GATE;
        const post  = (shape.postSize / 2);
        const w     = shape.beamHalfWidth;
        const d     = (LightLaneTuning.OBSTACLES.P.length / 2);
        const b     = new LightLaneObjectBuilder();
        for (const side of [-1, 1]) {
            const x = (side * shape.postX);
            b.box([(x - post), 0, -post], [(x + post), shape.postHeight, post], {top: color.LINE_DIM, side: color.LINE_DIM, bottom: null}, true);
        }
        for (const [y, up] of [[shape.beamBottom, -1], [shape.beamTop, 1]]) {
            b.line([-w, y, -d], [w, y, -d], lineSize, color.DANGER, [0, up, -1]);
            b.line([-w, y, d], [w, y, d], lineSize, color.DANGER, [0, up, 1]);
        }
        // No way over it: a red cross between its posts, above the beam.
        LightLaneModels._cross(b, ...shape.cross, -d, lineSize);

        return b.data();
    }

    // A red cross (LETHAL, glowing) in the plane z, over the rectangle (x0, y0) – (x1, y1): the way that is closed
    // (user request: one did not see where an obstacle cannot be passed).
    static _cross(b, x0, y0, x1, y1, z, lineSize) {
        const at = (z - LightLaneTuning.LINE_OUTSET - (lineSize / 2));
        b.bar([x0, y0, at], [x1, y1, at], lineSize, LightLaneTuning.COLOR.LETHAL, [0, 0, -1]);
        b.bar([x1, y0, at], [x0, y1, at], lineSize, LightLaneTuning.COLOR.LETHAL, [0, 0, -1]);
    }

    // A block 1.80 × 3.20 × L, its vertical corners cut at 45°, drawn by its DANGER edges only; a red cross on its
    // front face, orange crosses along the side crossSide (−1 left, +1 right).
    static _block(length, lineSize, crossSide) {
        const color = LightLaneTuning.COLOR;
        const shape = LightLaneTuning.SHAPES.BLOCK;
        const w     = shape.halfWidth;
        const h     = shape.height;
        const c     = shape.corner;
        const m     = shape.crossMargin;
        const l     = (length / 2);
        const o     = (LightLaneTuning.LINE_OUTSET + (lineSize / 2));
        const b     = new LightLaneObjectBuilder();
        // Drawn by its edges only (user request: no big dark faces): the outline of its top and of its bottom, its
        // vertical edges at the front and the back.
        const line = (from, to, normal) => b.bar(from, to, lineSize, color.DANGER, normal);
        for (const [y, up] of [[h + o, 1], [o, 0]]) {
            line([-w - o, y, -l + c], [-w - o, y, l - c], [-1, up, 0]);
            line([w + o, y, -l + c], [w + o, y, l - c], [1, up, 0]);
            line([-w + c, y, -l - o], [w - c, y, -l - o], [0, up, -1]);
            line([-w + c, y, l + o], [w - c, y, l + o], [0, up, 1]);
            // The corners cut at 45° (art § 5.2): the outline goes on round them.
            for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                line([sx * (w + o), y, sz * (l - c)], [sx * (w - c), y, sz * (l + o)], [sx, up, sz]);
            }
        }
        for (const [z, toward] of [[-l - o, -1], [l + o, 1]]) {
            line([-w + c, 0, z], [-w + c, h, z], [0, 0, toward]);
            line([w - c, 0, z], [w - c, h, z], [0, 0, toward]);
        }
        // Neither over nor under it: its front cross in red. Its sides cannot be entered either (a stumble): orange
        // crosses along them, about square (user request: crosses rather than full faces).
        LightLaneModels._cross(b, (-w + c), m, (w - c), (h - m), -l, lineSize);
        const count = Math.max(1, Math.round((2 * (l - c)) / h));
        const step  = ((2 * (l - c)) / count);
        // The crosses as lines with a volume, so the neon shows whatever the angle (user request), on the side the
        // camera sees only (crossSide: −1 left, +1 right; the presentation swaps the variant), so the far side's are not
        // seen through the block.
        const x = (crossSide * (w + o));
        for (let k = 0; k < count; k++) {
            const z0 = (-l + c + (k * step) + shape.sideCrossInset);
            const z1 = (-l + c + ((k + 1) * step) - shape.sideCrossInset);
            line([x, m, z0], [x, h - m, z1], [crossSide, 0, 0]);
            line([x, m, z1], [x, h - m, z0], [crossSide, 0, 0]);
        }

        return b.data();
    }

    // A tile with the hole of a gap (art § 5.2): the slab before and after it, the left line on both, LETHAL lines
    // across its front and back edges. Its side walls are objects of their own (holeWalls).
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
            b.line([-w, h, z0], [-w, h, z1], decorSize, color.LINE_DIM, null, true);
            LightLaneModels._marks(b, z0, z1);
        }
        b.line([-w, h, from], [w, h, from], lineSize, color.LETHAL, [0, 1, 1], true);
        b.line([-w, h, to], [w, h, to], lineSize, color.LETHAL, [0, 1, -1], true);

        return b.data();
    }

    // The flank of a neighbour lane seen through a hole (user request), over [z0, z1] of the tile's frame, at x = 0 (placed
    // on the lane's side), facing the hole (side −1: the hole's left wall, facing +x); its edge in neon too, as the
    // hole's front and back (user request), centred on the lane line, which it covers (thicker).
    static _holeWall(side, z0, z1) {
        const color = LightLaneTuning.COLOR;
        const h     = LightLaneTuning.TILE_THICKNESS;
        const b     = new LightLaneObjectBuilder();
        b.facing([[0, 0, z0], [0, h, z0], [0, h, z1], [0, 0, z1]], [side, (h / 2), ((z0 + z1) / 2)], LightLaneModels._glass(color.BODY_SIDE));
        b.line([0, h, z0], [0, h, z1], LightLaneTuning.LINE_SIZE, color.LETHAL, [0, 1, 0], true);

        return b.data();
    }

    // The warning zone's red edges of an outer lane (generation § 3, art tileWarn): LETHAL lines along both sides of a
    // tile, over its own lines (thicker); blinking, drawn every other half period.
    static _warnEdges() {
        const w = (LightLaneTuning.LANE_WIDTH / 2);
        const l = (LightLaneTuning.TILE_LENGTH / 2);
        const h = LightLaneTuning.TILE_THICKNESS;
        const b = new LightLaneObjectBuilder();
        for (const side of [-1, 1]) {
            b.line([side * w, h, -l], [side * w, h, l], LightLaneTuning.LINE_SIZE, LightLaneTuning.COLOR.LETHAL, [side, 1, 0], true);
        }

        return b.data();
    }

    // An amber chevron on the floor (art § 5.2 arrow, `size` [across, along]), its tip towards side (−1 left, +1 right):
    // the way back to the middle lanes at the start of a warning zone, a stalker's lane of destination.
    static _arrow(side, size) {
        const [across, along] = size;
        const y    = (LightLaneTuning.TILE_THICKNESS + LightLaneTuning.FLOOR_LIFT);
        const tip  = [(side * across / 2), y, 0];
        const b    = new LightLaneObjectBuilder();
        for (const end of [-1, 1]) {
            b.bar([(-side * across / 2), y, (end * along / 2)], tip, LightLaneTuning.LINE_SIZE, LightLaneTuning.COLOR.WARN, [0, 1, 0]);
        }

        return b.data();
    }

    // An octahedron (SHAPES.COIN), its bottom at the origin, glowing COIN.
    static _coin() {
        const hw     = LightLaneTuning.SHAPES.COIN.halfWidth;
        const hh     = LightLaneTuning.SHAPES.COIN.halfHeight;
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

    /**
     * @param {int} frame - 0 to FOG_FRAMES − 1
     * @returns {string} the URL of a frame of the fog (the track's, the home backdrop's)
     */
    static fogFrameUrl(frame) {
        return (LightLaneModels.ASSETS + 'textures/fog/fog_' + String(frame).padStart(2, '0') + '.jpg');
    }

    // The fog plane under the track (user request): a grid of cells FOG_TILE large, the texture (the 60 frames played
    // at FOG_FPS) mirrored every other cell across and along, so neighbour cells join without a seam (the picture does
    // not tile); a cell edge on the track's axis, under the track. Its z runs from 0, two cells more than the reach, so
    // it can step by a whole mirrored pair. Faces clockwise seen from above (the engine's front faces), as box()'s top.
    static _fog() {
        const [tileX, tileZ] = LightLaneTuning.FOG_TILE;
        const across = Math.ceil(LightLaneTuning.FOG_HALF_WIDTH / tileX);
        const along  = Math.ceil((LightLaneTuning.FOG_BEHIND + LightLaneTuning.FOG_AHEAD) / tileZ) + 2;
        const frames = [...Array(LightLaneTuning.FOG_FRAMES).keys()];
        const anim   = {ids: frames.map((i) => (i + 1)), duration: (1 / LightLaneTuning.FOG_FPS)};
        const points = [];
        const faces  = [];
        const point  = (x, z) => {
            points.push([x, 0, z]);
            return points.length;
        };
        const face = (pts, map) => ({pts: pts, color: [...LightLaneTuning.FOG_COLOR], texture: 1, map: map, textures: anim, lightGroup: LightLaneObjectBuilder.LIGHT_GROUP});
        for (let i = -across; i < across; i++) {
            for (let j = 0; j < along; j++) {
                const x0 = (i * tileX);
                const x1 = (x0 + tileX);
                const z0 = (j * tileZ);
                const z1 = (z0 + tileZ);
                // Mirrored every other cell: u (and v) run 0 → 1 then 1 → 0.
                const [u0, u1] = (((i % 2) === 0) ? [0, 1] : [1, 0]);
                const [v0, v1] = (((j % 2) === 0) ? [0, 1] : [1, 0]);
                const a = point(x0, z0);
                const b = point(x0, z1);
                const c = point(x1, z1);
                const d = point(x1, z0);
                faces.push(face([a, b, c], [[u0, v0], [u0, v1], [u1, v1]]), face([a, c, d], [[u0, v0], [u1, v1], [u1, v0]]));
            }
        }

        return {
            textures: frames.map((i) => LightLaneModels.fogFrameUrl(i)),
            points:   points,
            faces:    faces
        };
    }

    // An enemy (art § 5.2, user decision: the language of a light cycle, an original design), origin at the centre of its
    // bottom, its front towards −z: a two-wheeler of a real motorbike's size, its wheels without hub (a tyre whose sides
    // glow DANGER), each held in a cowl of one rounded shell that drops low between them, under a closed canopy of dark
    // glass; DANGER bands along its top and flanks, a WARN head light. A stalker (side −1 / +1, the way it will go) has 3
    // chevrons on its back pointing there; with `warning`, they and the flank band on that side turn WARN.
    static _enemy(side, warning) {
        const color    = LightLaneTuning.COLOR;
        const shape    = LightLaneTuning.ENEMY_SHAPE;
        const roles    = LightLaneModels.SECTION_ROLES;
        const b        = new LightLaneObjectBuilder();
        for (const z of shape.wheelZ) {
            LightLaneModels._wheel(b, z);
        }
        const stations = LightLaneModels._enemyStations();
        const rings    = stations.map((station) => LightLaneModels._section(station));
        const centre   = (station) => ((station[1] + station[2]) / 2);
        for (let i = 1; i < rings.length; i++) {
            const z      = ((stations[i - 1][0] + stations[i][0]) / 2);
            const inside = [0, ((centre(stations[i - 1]) + centre(stations[i])) / 2), z];
            const glass  = ((z > shape.glass[0]) && (z < shape.glass[1]));
            for (let k = 0; k < roles.length; k++) {
                const n    = ((k + 1) % roles.length);
                const quad = [rings[i - 1][k], rings[i - 1][n], rings[i][n], rings[i][k]];
                const role = roles[k];
                if (typeof role === 'number') {
                    // A glowing band: the top's (0), each flank's by its side (WARN on a warning stalker's side).
                    b.facing(quad, inside, (((side !== 0) && (role === side) && warning) ? color.WARN : color.DANGER), true);
                    continue;
                }
                b.facing(quad, inside, LightLaneModels._shellColor(role, glass));
            }
        }
        // The nose and tail caps.
        const nose = stations[0];
        const tail = stations[stations.length - 1];
        b.facing(rings[0], [0, centre(nose), (nose[0] + 1)], color.ENEMY_SIDE);
        b.facing(rings[rings.length - 1], [0, centre(tail), (tail[0] - 1)], color.ENEMY_SIDE);
        const [lightWidth, lightHeight] = shape.light;
        const noseY = centre(nose);
        b.rect((-lightWidth / 2), (noseY - (lightHeight / 2)), (lightWidth / 2), (noseY + (lightHeight / 2)), (nose[0] - LightLaneTuning.LINE_OUTSET), color.WARN, true);
        if (side !== 0) {
            LightLaneModels._chevrons(b, side, warning);
        }

        return b.data();
    }

    // The shell's stations [z, bottom y, top y, half width, flank band y]: its nose and tail (the bike's length), along
    // each wheel's upper half (equal angles, so the shell's flat faces stay within cowlGap of the round tyre), and
    // between the wheels.
    static _enemyStations() {
        const shape = LightLaneTuning.ENEMY_SHAPE;
        const half  = (LightLaneTuning.OBSTACLES.R.length / 2);
        const reach = (shape.radius + shape.cowlGap);
        const steps = (shape.arcStations - 1);
        const zs    = [-half];
        const arc   = (wheelZ) => {
            for (let i = 0; i <= steps; i++) {
                const z = (wheelZ + (reach * Math.cos(Math.PI * (1 - (i / steps)))));
                if (Math.abs(z - zs[zs.length - 1]) > LightLaneModels.EPSILON) {
                    zs.push(z);
                }
            }
        };
        arc(shape.wheelZ[0]);
        zs.push(...shape.middle);
        arc(shape.wheelZ[1]);
        if (zs[zs.length - 1] < (half - LightLaneModels.EPSILON)) {
            zs.push(half);
        }

        return zs.map((z) => {
            const bottom = LightLaneModels._enemyBottom(z);
            const top    = LightLaneModels._enemyTop(z);
            return [z, bottom, top, LightLaneModels._curve(shape.width, z), LightLaneModels._curve(shape.flank, z)];
        });
    }

    // The shell's underside at z: its belly, kept cowlGap off the tyres.
    static _enemyBottom(z) {
        const shape = LightLaneTuning.ENEMY_SHAPE;

        return Math.max(LightLaneModels._overWheels(z, (shape.radius + shape.cowlGap)), LightLaneModels._curve(shape.belly, z));
    }

    // The shell's top at z: its top line, with cowlThick of shell at least over the wheels.
    static _enemyTop(z) {
        const shape = LightLaneTuning.ENEMY_SHAPE;

        return Math.max(LightLaneModels._overWheels(z, (shape.radius + shape.cowlGap + shape.cowlThick)), LightLaneModels._curve(shape.top, z));
    }

    // A smooth curve through [z, value] points (cubic Hermite, tangents from the neighbours), flat beyond its ends.
    static _curve(points, z) {
        const last = (points.length - 1);
        if (z <= points[0][0]) {
            return points[0][1];
        }
        if (z >= points[last][0]) {
            return points[last][1];
        }
        let i = 0;
        while (z > points[i + 1][0]) {
            i++;
        }
        const slope = (k) => {
            const [za, ya] = points[Math.max(0, (k - 1))];
            const [zb, yb] = points[Math.min(last, (k + 1))];
            return ((yb - ya) / (zb - za));
        };
        const [z0, y0] = points[i];
        const [z1, y1] = points[i + 1];
        const span     = (z1 - z0);
        const t        = ((z - z0) / span);
        const t2       = (t * t);
        const t3       = (t2 * t);

        return ((((2 * t3) - (3 * t2) + 1) * y0) + ((t3 - (2 * t2) + t) * span * slope(i)) + (((3 * t2) - (2 * t3)) * y1) + ((t3 - t2) * span * slope(i + 1)));
    }

    // The highest point at z of the circles of the given radius around the wheels' axles; −Infinity off both.
    static _overWheels(z, radius) {
        const shape = LightLaneTuning.ENEMY_SHAPE;
        let   y     = -Infinity;
        for (const wheelZ of shape.wheelZ) {
            const dz = (z - wheelZ);
            if (Math.abs(dz) <= (radius + LightLaneModels.EPSILON)) {
                y = Math.max(y, (shape.radius + Math.sqrt(Math.max(0, ((radius * radius) - (dz * dz))))));
            }
        }

        return y;
    }

    // A rounded section of the shell at a station [z, bottom, top, half width, flank band y], in SECTION_ROLES order from
    // the right flank up and round: a squarer round than an ellipse (|cos|^ROUND, |sin|^ROUND), flat bands on the flanks
    // and top; the flank band kept within FLANK_HIGH × the half height of mid height (between the rounded corners, so the
    // section stays convex), its half width FLANK_BAND × the half height at most.
    static _section([z, bottom, top, halfWidth, flankY]) {
        const centre = ((top + bottom) / 2);
        const half   = ((top - bottom) / 2);
        const band   = (LightLaneTuning.ENEMY_SHAPE.band / 2);
        const flank  = Math.min(band, (half * LightLaneModels.FLANK_BAND));
        const reach  = (half * LightLaneModels.FLANK_HIGH);
        const level  = Math.min(Math.max(flankY, (centre - reach)), (centre + reach));
        const round  = (degrees) => {
            const angle = ((degrees * Math.PI) / 180);
            const c     = Math.cos(angle);
            const s     = Math.sin(angle);
            return [(Math.sign(c) * halfWidth * Math.pow(Math.abs(c), LightLaneModels.ROUND)), (centre + (Math.sign(s) * half * Math.pow(Math.abs(s), LightLaneModels.ROUND))), z];
        };
        const [upRight, upLeft, downLeft, downRight] = LightLaneModels.SECTION_ROUNDS;

        return [
            [halfWidth, (level - flank), z], [halfWidth, (level + flank), z], round(upRight), [band, top, z], [-band, top, z],
            round(upLeft), [-halfWidth, (level + flank), z], [-halfWidth, (level - flank), z], round(downLeft), [0, bottom, z],
            round(downRight)
        ];
    }

    // A shell face's colour by its role: its top lighter (dark glass on the canopy), its flanks darker, its bottom darkest.
    static _shellColor(role, glass) {
        const color = LightLaneTuning.COLOR;
        if (role === LightLaneModels.SHELL_TOP) {
            return ((glass) ? color.BODY_TOP : color.ENEMY_TOP);
        }

        return ((role === LightLaneModels.SHELL_BOTTOM) ? color.ENEMY_BOTTOM : color.ENEMY_SIDE);
    }

    // A wheel without hub at z: its tyre (outer and inner faces dark, both sides glowing DANGER), on the ground.
    static _wheel(b, z) {
        const shape  = LightLaneTuning.ENEMY_SHAPE;
        const outer  = shape.radius;
        const inner  = (shape.radius - shape.tyre);
        const x      = shape.halfThick;
        const centre = [0, outer, z];
        const at     = (radius, angle, side) => [(side * x), (outer + (radius * Math.sin(angle))), (z + (radius * Math.cos(angle)))];
        for (let k = 0; k < shape.segments; k++) {
            const a0 = ((2 * Math.PI * k) / shape.segments);
            const a1 = ((2 * Math.PI * (k + 1)) / shape.segments);
            const am = ((a0 + a1) / 2);
            b.facing([at(outer, a0, -1), at(outer, a1, -1), at(outer, a1, 1), at(outer, a0, 1)], centre, LightLaneTuning.COLOR.BODY_SIDE);
            // The tunnel's inside faces the axis.
            const away = [0, (outer + (2 * outer * Math.sin(am))), (z + (2 * outer * Math.cos(am)))];
            b.facing([at(inner, a0, -1), at(inner, a1, -1), at(inner, a1, 1), at(inner, a0, 1)], away, LightLaneTuning.COLOR.BODY_BOTTOM);
            for (const side of [-1, 1]) {
                b.facing([at(inner, a0, side), at(outer, a0, side), at(outer, a1, side), at(inner, a1, side)], centre, LightLaneTuning.COLOR.DANGER, true);
            }
        }
    }

    // A stalker's 3 chevrons on its back, over the rear cowl, pointing the way it will go (WARN while it announces it).
    static _chevrons(b, side, warning) {
        const shape  = LightLaneTuning.ENEMY_SHAPE;
        const line   = LightLaneTuning.LINE_SIZE;
        const [across, along] = shape.chevron;
        const rgb    = ((warning) ? LightLaneTuning.COLOR.WARN : LightLaneTuning.COLOR.DANGER);
        for (let k = 0; k < shape.chevrons; k++) {
            const z    = (shape.chevronFrom - (k * along * 2));
            const roof = (Math.max(LightLaneModels._enemyTop(z - (along / 2)), LightLaneModels._enemyTop(z + (along / 2))) + LightLaneTuning.LINE_OUTSET + (line / 2));
            const tip  = [(side * across / 2), roof, z];
            b.bar([(-side * across / 2), roof, (z - (along / 2))], tip, line, rgb, [0, 1, 0]);
            b.bar([(-side * across / 2), roof, (z + (along / 2))], tip, line, rgb, [0, 1, 0]);
        }
    }

    // A piece of a bike's light trail (user decision): a thin wall TRAIL_THICK × TRAIL_HEIGHT × length from the floor,
    // centred on its origin along z, in as many slices as `fades` (from −z to +z), each its sides and top glowing and
    // additive in DANGER, its fade (its band's TRAIL_FADE) as its alpha: the renderer whitens a
    // glowing face's colour towards its core (coreWhite) before the alpha, so a dimmed colour would hardly fade.
    //
    // `toEnd`: the distance from its +z end to the trail's end, when it holds the end's rounding (user request: the trail
    // ends like the bike's wheel seen from the side, a half disc of TRAIL_HEIGHT / 2), null otherwise.
    static _trailWall(length, fades, toEnd = null) {
        const w      = (LightLaneTuning.TRAIL_THICK / 2);
        const step   = (length / fades.length);
        const b      = new LightLaneObjectBuilder();
        fades.forEach((fade, k) => {
            const z0  = ((-length / 2) + (k * step));
            const z1  = (z0 + step);
            const rgb = [...LightLaneTuning.COLOR.DANGER, fade];
            // Cut finer where the rounding bends the wall.
            const cuts = (((toEnd !== null) && ((toEnd + ((length / 2) - z1)) < LightLaneModels.trailRadius())) ? Math.ceil(step / LightLaneModels.TRAIL_ROUND_STEP) : 1);
            for (let c = 0; c < cuts; c++) {
                const za = (z0 + ((c * step) / cuts));
                const zb = (z0 + (((c + 1) * step) / cuts));
                const [la, ha] = LightLaneModels._trailSpan(za, length, toEnd);
                const [lb, hb] = LightLaneModels._trailSpan(zb, length, toEnd);
                const inside   = [0, ((la + ha + lb + hb) / 4), ((za + zb) / 2)];
                for (const x of [-w, w]) {
                    b.facing([[x, la, za], [x, ha, za], [x, hb, zb], [x, lb, zb]], inside, rgb, true, true);
                }
                b.facing([[-w, ha, za], [w, ha, za], [w, hb, zb], [-w, hb, zb]], inside, rgb, true, true);
            }
        });

        return b.data();
    }

    // The trail's end rounding: a half disc of the wheel's radius (half the trail's height).
    static trailRadius() {
        return (LightLaneTuning.TRAIL_HEIGHT / 2);
    }

    // The wall's [bottom, top] at z of a piece `length` long: full, or within the end's half disc.
    static _trailSpan(z, length, toEnd) {
        const r = LightLaneModels.trailRadius();
        if (toEnd === null) {
            return [0, LightLaneTuning.TRAIL_HEIGHT];
        }
        const fromEnd = (toEnd + ((length / 2) - z));
        if (fromEnd >= r) {
            return [0, LightLaneTuning.TRAIL_HEIGHT];
        }
        const u    = (r - fromEnd);
        const half = Math.sqrt(Math.max(0, ((r * r) - (u * u))));

        return [(r - half), (r + half)];
    }

    // The Sentinel (art § 5.2): a hovering arch over the lanes (SENTINEL_SHAPE, user request: an original design) — a
    // crown, a head under its middle, two legs slanting out and down, in the body's colours, their outlines in DANGER
    // lines on both faces; the slot at the head's front in `slot` (WARN, LETHAL while it strikes), towards −z (the runner).
    static _sentinel(slot) {
        const shape  = LightLaneTuning.SENTINEL_SHAPE;
        const mirror = (outline) => outline.map(([x, y]) => [-x, y]).reverse();
        const b      = new LightLaneObjectBuilder();
        for (const [outline, depth] of [[shape.crown.outline, shape.crown.depth], [shape.head.outline, shape.head.depth],
            [shape.leg.outline, shape.leg.depth], [mirror(shape.leg.outline), shape.leg.depth]]) {
            LightLaneModels._extrude(b, outline, depth);
        }
        const [width, height, y] = shape.slot;
        b.rect((-width / 2), (y - (height / 2)), (width / 2), (y + (height / 2)), (shape.head.depth[0] - LightLaneTuning.LINE_OUTSET), slot, true);

        return b.data();
    }

    // A convex outline [x, y] (clockwise seen from the front) from z0 to z1 in the body's colours, its edges in DANGER
    // lines on its front and back faces.
    static _extrude(b, outline, [z0, z1]) {
        const color  = LightLaneTuning.COLOR;
        const line   = LightLaneTuning.LINE_SIZE;
        const o      = (LightLaneTuning.LINE_OUTSET + (line / 2));
        const n      = outline.length;
        const cx     = (outline.reduce((sum, [x]) => (sum + x), 0) / n);
        const cy     = (outline.reduce((sum, [, y]) => (sum + y), 0) / n);
        const inside = [cx, cy, ((z0 + z1) / 2)];
        b.facing(outline.map(([x, y]) => [x, y, z0]), inside, color.BODY_SIDE);
        b.facing(outline.map(([x, y]) => [x, y, z1]), inside, color.BODY_SIDE);
        for (let i = 0; i < n; i++) {
            const [xa, ya] = outline[i];
            const [xb, yb] = outline[(i + 1) % n];
            // Its sides: lighter facing up, darker facing down (the body's top and bottom).
            const up = ((xb - xa) > LightLaneModels.EPSILON);
            b.facing([[xa, ya, z0], [xb, yb, z0], [xb, yb, z1], [xa, ya, z1]], inside, ((up) ? color.BODY_TOP : color.BODY_BOTTOM));
            b.bar([xa, ya, (z0 - o)], [xb, yb, (z0 - o)], line, color.DANGER, [0, 0, -1]);
            b.bar([xa, ya, (z1 + o)], [xb, yb, (z1 + o)], line, color.DANGER, [0, 0, 1]);
        }
    }

    // A strike's mark on the floor (art § 5.2): `width` across, from 0 to its length along, LETHAL, see-through, glowing.
    static _strikeMark(width) {
        const y      = (LightLaneTuning.TILE_THICKNESS + LightLaneTuning.FLOOR_LIFT);
        const length = (LightLaneTuning.STRIKE_MARK[0] + LightLaneTuning.STRIKE_MARK[1]);
        const w      = (width / 2);
        const b      = new LightLaneObjectBuilder();
        b.polygon([[-w, y, 0], [-w, y, length], [w, y, length], [w, y, 0]], [...LightLaneTuning.COLOR.LETHAL, LightLaneTuning.STRIKE_MARK_ALPHA], true);

        return b.data();
    }

    // A strike's column (STRIKE_BEAM [width, height, length]), from the floor, from 0 along: LETHAL, additive, glowing.
    static _strikeBeam() {
        const [width, height, length] = LightLaneTuning.STRIKE_BEAM;
        const w      = (width / 2);
        const y      = LightLaneTuning.TILE_THICKNESS;
        const inside = [0, (y + (height / 2)), (length / 2)];
        const rgb    = LightLaneTuning.COLOR.LETHAL;
        const b      = new LightLaneObjectBuilder();
        b.facing([[-w, (y + height), 0], [w, (y + height), 0], [w, (y + height), length], [-w, (y + height), length]], inside, rgb, true, true);
        b.facing([[-w, y, 0], [w, y, 0], [w, (y + height), 0], [-w, (y + height), 0]], inside, rgb, true, true);
        for (const x of [-w, w]) {
            b.facing([[x, y, 0], [x, (y + height), 0], [x, (y + height), length], [x, y, length]], inside, rgb, true, true);
        }

        return b.data();
    }

    // A sweep's warning frame (art § 5.2): WARN lines around `width` × [y0, y1], in the plane z = 0.
    static _sweepFrame(width, [y0, y1]) {
        const w    = (width / 2);
        const h    = LightLaneTuning.TILE_THICKNESS;
        const line = LightLaneTuning.LINE_SIZE;
        const rgb  = LightLaneTuning.COLOR.WARN;
        const b    = new LightLaneObjectBuilder();
        b.bar([-w, (h + y0), 0], [w, (h + y0), 0], line, rgb, [0, 0, -1]);
        b.bar([-w, (h + y1), 0], [w, (h + y1), 0], line, rgb, [0, 0, -1]);
        b.bar([-w, (h + y0), 0], [-w, (h + y1), 0], line, rgb, [0, 0, -1]);
        b.bar([w, (h + y0), 0], [w, (h + y1), 0], line, rgb, [0, 0, -1]);

        return b.data();
    }

    // A sweep's ray (art § 5.2): a sheet `width` × [y0, y1], SWEEP_THICK deep, DANGER, see-through and additive; its top
    // and bottom edges in glowing DANGER lines.
    static _sweepRay(width, [y0, y1]) {
        const w      = (width / 2);
        const h      = LightLaneTuning.TILE_THICKNESS;
        const d      = (LightLaneTuning.SWEEP_THICK / 2);
        const rgb    = LightLaneTuning.COLOR.DANGER;
        const sheet  = [...rgb, LightLaneTuning.SWEEP_ALPHA];
        const inside = [0, (h + ((y0 + y1) / 2)), 0];
        const b      = new LightLaneObjectBuilder();
        b.facing([[-w, (h + y0), -d], [w, (h + y0), -d], [w, (h + y1), -d], [-w, (h + y1), -d]], inside, sheet, true, true);
        b.facing([[-w, (h + y1), -d], [w, (h + y1), -d], [w, (h + y1), d], [-w, (h + y1), d]], inside, sheet, true, true);
        b.bar([-w, (h + y0), -d], [w, (h + y0), -d], LightLaneTuning.LINE_SIZE, rgb, [0, -1, -1]);
        b.bar([-w, (h + y1), -d], [w, (h + y1), -d], LightLaneTuning.LINE_SIZE, rgb, [0, 1, -1]);

        return b.data();
    }

    // The track's right edge line along a tile; cut at the hole of a gap in the rightmost lane (no rail over the void).
    static _tileEdge(lineSize, gap) {
        const w     = (LightLaneTuning.LANE_WIDTH / 2);
        const l     = (LightLaneTuning.TILE_LENGTH / 2);
        const h     = LightLaneTuning.TILE_THICKNESS;
        const b     = new LightLaneObjectBuilder();
        const spans = ((gap === null) ? [[-l, l]] : [[-l, LightLaneModels._hole(gap)[0]], [LightLaneModels._hole(gap)[1], l]]);
        for (const [z0, z1] of spans) {
            b.line([w, h, z0], [w, h, z1], lineSize, LightLaneTuning.COLOR.LINE_DIM, null, true);
        }

        return b.data();
    }
}

LightLaneModels.ASSETS     = './assets/lightLane/';
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
// An outer lane's first tile, its front face shown (3 → 5 lanes).
LightLaneModels.TILE_FRONT = 'tileFront';
LightLaneModels.ROW5       = 'row5';
LightLaneModels.HOLE_WALL  = 'holeWall';
// A hole's wall variants by the side of the hole it stands on: [suffix, side].
LightLaneModels.WALL_SIDES = Object.freeze([['L', -1], ['R', 1]]);
LightLaneModels.WARN_EDGES = 'warnEdges';
LightLaneModels.ARROW      = 'arrow';
// The chevrons by the way they point: [suffix, side].
LightLaneModels.ARROW_SIDES = Object.freeze([['L', -1], ['R', 1]]);
LightLaneModels.STALKER_ARROW = 'stalkerArrow';
// A piece of a bike's trail, by band and length (trailCode).
LightLaneModels.TRAIL      = 'trail';
// The steps of the trail's end rounding, m.
LightLaneModels.TRAIL_ROUND_STEP = 0.1;
// The trail's tail with its rounded end, whole; a slice of it: + its index.
LightLaneModels.TRAIL_TAIL = 'trailTail';
LightLaneModels.PROWLER    = 'prowler';
// A stalker by the way it goes (ARROW_SIDES suffix), and WARN while it announces it.
LightLaneModels.STALKER    = 'stalker';
LightLaneModels.WARN       = 'Warn';
LightLaneModels.SENTINEL   = 'sentinel';
LightLaneModels.SENTINEL_STRIKE = 'sentinelStrike';
// A strike's mark, by its width step (1 to STRIKE_WIDTHS.length), and its column.
LightLaneModels.STRIKE_MARK = 'strikeMark';
LightLaneModels.STRIKE_BEAM = 'strikeBeam';
// A sweep: its warning frame and its ray, by lanes (3, 5) and height.
LightLaneModels.SWEEP_WARN = 'sweepWarn';
LightLaneModels.SWEEP      = 'sweep';
LightLaneModels.SWEEP_LANES = Object.freeze(['3', '5']);
// The enemies' shell: the roundness of its sections (1 an ellipse, lower squarer); a section's faces in order from its
// right flank up and round (a number: a glowing band, by its side, 0 the top), and the angles of its rounded corners.
LightLaneModels.ROUND        = 0.6;
LightLaneModels.SHELL_TOP    = 'top';
LightLaneModels.SHELL_SIDE   = 'side';
LightLaneModels.SHELL_BOTTOM = 'bottom';
LightLaneModels.SECTION_ROLES = Object.freeze([
    1, LightLaneModels.SHELL_SIDE, LightLaneModels.SHELL_TOP, 0, LightLaneModels.SHELL_TOP, LightLaneModels.SHELL_SIDE,
    -1, LightLaneModels.SHELL_SIDE, LightLaneModels.SHELL_BOTTOM, LightLaneModels.SHELL_BOTTOM, LightLaneModels.SHELL_SIDE
]);
LightLaneModels.SECTION_ROUNDS = Object.freeze([45, 135, 225, 315]);
// The flank band: within FLANK_HIGH × the half height of mid height (between the round corners, so the section stays
// convex), its half width FLANK_BAND × the half height at most.
LightLaneModels.FLANK_HIGH   = 0.5;
LightLaneModels.FLANK_BAND   = 0.3;
// Lengths closer than this are equal (m): a hole's side wall shorter is not built, a floor mark is found at its z.
LightLaneModels.EPSILON    = 0.01;
LightLaneModels.TILE_EDGE  = 'tileEdge';
LightLaneModels.FOG        = 'fog';
// A whole row of 3 lanes in one tile (user request: no separation between lanes but at a gap).
LightLaneModels.ROW3       = 'row3';
// The background picture's texture id (load()).
LightLaneModels._skyId     = null;
LightLaneModels.RUNNER     = 'runner';
LightLaneModels.HURDLE     = 'hurdle';
LightLaneModels.GATE       = 'gate';
LightLaneModels.COIN       = 'coin';
LightLaneModels.SHARD      = 'shard';
LightLaneModels.BLOCKS     = Object.freeze(['B3', 'B6', 'B10', 'B16']);
// A block's variants by the side of its crosses: [suffix, side].
LightLaneModels.BLOCK_SIDES = Object.freeze([['L', -1], ['R', 1]]);
LightLaneModels.GAPS       = Object.freeze(['X3', 'X5']);
// One shard object a colour (art § 5.2): name → palette code.
LightLaneModels.SHARD_COLORS = Object.freeze({Player: 'PLAYER', Danger: 'DANGER'});
// The codes read every frame, built once (no string a frame): a block's [B3…] (with its crosses on the left, on the
// right), a stalker's [to the left, to the right][plain, warning], a trail's [band][long, short] pieces, its tail's slices.
LightLaneModels.BLOCK_CODES      = Object.freeze(Object.fromEntries(LightLaneModels.BLOCKS.map((code) => [code, ('block' + code.slice(1))])));
LightLaneModels.BLOCK_SIDE_CODES = Object.freeze(Object.fromEntries(LightLaneModels.BLOCKS.map((code) => [code,
    Object.freeze(LightLaneModels.BLOCK_SIDES.map(([suffix]) => (LightLaneModels.BLOCK_CODES[code] + suffix)))])));
LightLaneModels.STALKER_CODES    = Object.freeze(LightLaneModels.ARROW_SIDES.map(([suffix]) => Object.freeze([(LightLaneModels.STALKER + suffix), (LightLaneModels.STALKER + suffix + LightLaneModels.WARN)])));
LightLaneModels.TRAIL_CODES      = Object.freeze([...Array(LightLaneTuning.TRAIL_BANDS).keys()].map((band) => Object.freeze([LightLaneTuning.TRAIL_PIECE_LONG, LightLaneTuning.TRAIL_PIECE_SHORT].map((length) => (LightLaneModels.TRAIL + band + '_' + length)))));
LightLaneModels.TRAIL_TAIL_CODES = Object.freeze([...Array(LightLaneTuning.TRAIL_TAIL_SLICES).keys()].map((k) => (LightLaneModels.TRAIL_TAIL + k)));
