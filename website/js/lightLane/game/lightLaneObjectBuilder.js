/**
 * Object3dLoader data built from boxes and lines (art § 4, § 5.2). Faces: corners clockwise as seen from outside (the
 * engine's front faces); a line's faces glow.
 */
class LightLaneObjectBuilder {
    constructor() {
        this._points = [];
        this._faces  = [];
        this._floor  = false;
    }

    /**
     * The faces made next are floor (true): painted LIGHT_COMPENSATION times lighter, outside the light group, so the
     * runner's light shows on them; the others (false) are in LightLaneModels.LIGHT_GROUP, whose factor keeps their
     * look under the lowered ambient.
     *
     * @param {boolean} floor
     */
    setFloor(floor) {
        this._floor = floor;

        return this;
    }

    /**
     * An axis-aligned box.
     *
     * @param {number[]} min
     * @param {number[]} max
     * @param {{top: number[]|null, side: number[], bottom: number[]|null, front?: number[]|null, back?: number[]|null}}
     *        colors - 0-255; front (−z) and back (+z) default to side; null leaves that face out (never seen: the
     *        camera stays above the ground and looks ahead)
     * @param {boolean}  glow
     */
    box(min, max, colors, glow = false) {
        const [x0, y0, z0] = min;
        const [x1, y1, z1] = max;
        const p = (x, y, z) => {
            this._points.push([x, y, z]);
            return this._points.length;
        };
        const c = [
            p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0),
            p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)
        ];
        // c[0..3]: the front (z0) corners from bottom left, clockwise seen from the front; c[4..7]: the same at z1.
        const front = ((colors.front === undefined) ? colors.side : colors.front);
        const back  = ((colors.back === undefined) ? colors.side : colors.back);
        if (colors.top !== null) {
            this._face([c[3], c[7], c[6], c[2]], colors.top, glow);
        }
        if (colors.bottom !== null) {
            this._face([c[0], c[1], c[5], c[4]], colors.bottom, glow);
        }
        if (front !== null) {
            this._face([c[0], c[3], c[2], c[1]], front, glow);
        }
        if (back !== null) {
            this._face([c[5], c[6], c[7], c[4]], back, glow);
        }
        this._face([c[4], c[7], c[3], c[0]], colors.side, glow);
        this._face([c[1], c[2], c[6], c[5]], colors.side, glow);

        return this;
    }

    /**
     * A line (art § 4): an axis-aligned glowing box of section size × size along the edge from → to, pushed
     * LINE_OUTSET outward along the other two axes' signs of `outward` (default: up and away from x = 0).
     *
     * @param {number[]} from
     * @param {number[]} to
     * @param {number}   size
     * @param {number[]} color
     * @param {number[]} outward - per axis -1, 0 or +1: the side the line leans to across the edge
     */
    line(from, to, size, color, outward = null) {
        const lean = (outward ?? [Math.sign(from[0] + to[0]), 1, 0]);
        const min  = [0, 0, 0];
        const max  = [0, 0, 0];
        for (let axis = 0; axis < 3; axis++) {
            const a = Math.min(from[axis], to[axis]);
            const b = Math.max(from[axis], to[axis]);
            if ((b - a) > 0) {
                min[axis] = a;
                max[axis] = b;
                continue;
            }
            const centre = (a + (lean[axis] * LightLaneTuning.LINE_OUTSET));
            min[axis] = (centre - (size / 2));
            max[axis] = (centre + (size / 2));
        }

        return this.box(min, max, {top: color, side: color, bottom: color}, true);
    }

    /**
     * A line between any two points (art § 4): a box of section size × size along from → to, its faces glowing; one
     * side of the section turned towards `normal`.
     *
     * @param {number[]} from
     * @param {number[]} to
     * @param {number}   size
     * @param {number[]} color
     * @param {number[]} normal - a direction across the line (the side it faces)
     */
    bar(from, to, size, color, normal) {
        const sub   = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
        const add   = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
        const mul   = (p, k) => [p[0] * k, p[1] * k, p[2] * k];
        const dot   = (p, q) => ((p[0] * q[0]) + (p[1] * q[1]) + (p[2] * q[2]));
        const cross = (p, q) => [(p[1] * q[2]) - (p[2] * q[1]), (p[2] * q[0]) - (p[0] * q[2]), (p[0] * q[1]) - (p[1] * q[0])];
        const norm  = (p) => mul(p, 1 / Math.hypot(...p));
        const a = norm(sub(to, from));
        const n = norm(sub(normal, mul(a, dot(a, normal))));
        const b = cross(a, n);
        const h = (size / 2);
        const corner = (p, sn, sb) => add(add(p, mul(n, sn * h)), mul(b, sb * h));
        const ring   = (p) => [corner(p, -1, -1), corner(p, 1, -1), corner(p, 1, 1), corner(p, -1, 1)];
        const first  = ring(from);
        const last   = ring(to);
        const centre = mul(add(from, to), 0.5);
        const quads  = [[first[0], first[1], first[2], first[3]], [last[3], last[2], last[1], last[0]]];
        for (let i = 0; i < 4; i++) {
            const j = ((i + 1) % 4);
            quads.push([first[i], last[i], last[j], first[j]]);
        }
        for (const quad of quads) {
            this.polygon(this._outward(quad, centre), color, true);
        }

        return this;
    }

    /**
     * A prism: a polygon of the xz plane (corners clockwise seen from above) from y0 to y1.
     *
     * @param {number[][]} outline - [[x, z], ...]
     * @param {number}     y0
     * @param {number}     y1
     * @param {{top: number[], side: number[], bottom: number[]}} colors
     */
    prism(outline, y0, y1, colors) {
        const top    = outline.map(([x, z]) => [x, y1, z]);
        const bottom = outline.map(([x, z]) => [x, y0, z]).reverse();
        this.polygon(top, colors.top);
        if (colors.bottom !== null) {
            this.polygon(bottom, colors.bottom);
        }
        const n = outline.length;
        for (let i = 0; i < n; i++) {
            const [xa, za] = outline[i];
            const [xb, zb] = outline[(i + 1) % n];
            // Seen from outside, going clockwise above: the side's corners bottom a, top a, top b, bottom b.
            this.polygon([[xa, y0, za], [xa, y1, za], [xb, y1, zb], [xb, y0, zb]].reverse(), colors.side);
        }

        return this;
    }

    /**
     * A face given by its corners (clockwise seen from outside).
     *
     * @param {number[][]} corners - [[x, y, z], ...]
     * @param {number[]}   color   - 0-255, a fourth value is the alpha (0-1)
     * @param {boolean}    glow
     * @param {boolean}    blendAdd
     */
    polygon(corners, color, glow = false, blendAdd = false) {
        const pts = corners.map((p) => {
            this._points.push([p[0], p[1], p[2]]);
            return this._points.length;
        });
        this._face(pts, color, glow, blendAdd);

        return this;
    }

    /**
     * A face turned to face away from a point inside (any corner order).
     *
     * @param {number[][]} corners
     * @param {number[]}   inside
     * @param {number[]}   color
     * @param {boolean}    glow
     * @param {boolean}    blendAdd
     */
    facing(corners, inside, color, glow = false, blendAdd = false) {
        return this.polygon(this._outward(corners, inside), color, glow, blendAdd);
    }

    /**
     * A flat rectangle in the plane z, facing −z (the camera, which looks ahead).
     *
     * @param {number}   x0
     * @param {number}   y0
     * @param {number}   x1
     * @param {number}   y1
     * @param {number}   z
     * @param {number[]} color
     * @param {boolean}  glow
     */
    rect(x0, y0, x1, y1, z, color, glow = false) {
        return this.polygon([[x0, y0, z], [x0, y1, z], [x1, y1, z], [x1, y0, z]], color, glow);
    }

    data() {
        return {points: this._points, faces: this._faces};
    }

    // The corners in the order that makes the face front-facing from outside (away from `inside`).
    _outward(quad, inside) {
        const [p, q, r] = quad;
        const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
        const v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
        // Clockwise seen from outside in the engine's left-handed frame: u × v (computed as usual) points outside,
        // as on the top face of box().
        const n = [(u[1] * v[2]) - (u[2] * v[1]), (u[2] * v[0]) - (u[0] * v[2]), (u[0] * v[1]) - (u[1] * v[0])];
        const out = [p[0] - inside[0], p[1] - inside[1], p[2] - inside[2]];

        return ((((n[0] * out[0]) + (n[1] * out[1]) + (n[2] * out[2])) < 0) ? quad.slice().reverse() : quad);
    }

    // Object3dLoader reads three corners a face (object3dLoader.js): a polygon goes in as a fan of triangles from its
    // first corner, which keeps the corners' turn.
    // A floor colour under the lowered ambient: LIGHT_COMPENSATION times lighter, an alpha kept.
    static _lighter(color) {
        const k = LightLaneTuning.LIGHT_COMPENSATION;

        return color.map((c, i) => ((i < 3) ? Math.min(LightLaneObjectBuilder.CHANNEL_MAX, (c * k)) : c));
    }

    _face(pts, color, glow, blendAdd = false) {
        const paint = ((this._floor) ? LightLaneObjectBuilder._lighter(color) : [...color]);
        for (let i = 1; (i + 1) < pts.length; i++) {
            const face = {pts: [pts[0], pts[i], pts[i + 1]], color: [...paint]};
            if (!this._floor) {
                face.lightGroup = LightLaneObjectBuilder.LIGHT_GROUP;
            }
            if (glow) {
                face.glow = true;
            }
            if (blendAdd) {
                face.blendAdd = true;
            }
            this._faces.push(face);
        }
    }
}

LightLaneObjectBuilder.LIGHT_GROUP = 'lit';
LightLaneObjectBuilder.CHANNEL_MAX = 255;
