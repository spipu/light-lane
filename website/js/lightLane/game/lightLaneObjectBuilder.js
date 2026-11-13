/**
 * Object3dLoader data built from boxes and lines (art § 4, § 5.2). Faces: corners clockwise as seen from outside (the
 * engine's front faces); a line's faces glow.
 */
class LightLaneObjectBuilder {
    constructor() {
        this._points = [];
        this._faces  = [];
    }

    /**
     * An axis-aligned box.
     *
     * @param {number[]} min
     * @param {number[]} max
     * @param {{top: number[], side: number[], bottom: number[]}} colors - 0-255
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
        this._face([c[3], c[7], c[6], c[2]], colors.top, glow);
        this._face([c[0], c[1], c[5], c[4]], colors.bottom, glow);
        this._face([c[0], c[3], c[2], c[1]], colors.side, glow);
        this._face([c[5], c[6], c[7], c[4]], colors.side, glow);
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

    data() {
        return {points: this._points, faces: this._faces};
    }

    _face(pts, color, glow) {
        const face = {pts: pts, color: [...color]};
        if (glow) {
            face.glow = true;
        }
        this._faces.push(face);
    }
}
