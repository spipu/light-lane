/**
 * The effects of art § 7 the presentation plays: shards (tetrahedra flying from a point, falling, spinning, fading
 * out), the flash of the scene light (Engine3d.setLightBoost, back to 0 in FLASH_TIME) and the camera shake (a random
 * offset whose amplitude falls linearly). Its instances are pooled, made once per colour.
 */
class LightLaneEffects {
    constructor() {
        this._shards = [];   // {instance, colour, life, x, y, z, vx, vy, vz, spin, angle}
        this._flash  = 0;
        this._flashFrom = 0;
        this._shake  = {amplitude: 0, time: 0, left: 0};
        this.offset  = [0, 0, 0];
    }

    // Once the objects are loaded: a pool of SHARD_COUNT instances per shard colour.
    bind() {
        for (const name of Object.keys(LightLaneModels.SHARD_COLORS)) {
            const id = LightLaneModels.objectId(LightLaneModels.SHARD + name);
            for (let i = 0; i < LightLaneTuning.SHARD_COUNT; i++) {
                this._shards.push({instance: LightLanePresentation.instance(id), colour: name, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, angle: 0});
            }
        }

        return this;
    }

    // Everything stopped (a new run).
    reset() {
        this._shards.forEach((shard) => {
            shard.life = 0;
        });
        this._flash      = 0;
        this._shake.left = 0;
        this.offset[0] = this.offset[1] = this.offset[2] = 0;

        return this;
    }

    /**
     * @param {number[]} at     - the centre
     * @param {int}      count
     * @param {string}   colour - a LightLaneModels.SHARD_COLORS name
     */
    burst(at, count, colour) {
        let left = count;
        for (const shard of this._shards) {
            if ((left === 0) || (shard.colour !== colour) || (shard.life > 0)) {
                continue;
            }
            const speed   = (LightLaneTuning.SHARD_SPEED_MIN + (Math.random() * (LightLaneTuning.SHARD_SPEED_MAX - LightLaneTuning.SHARD_SPEED_MIN)));
            const heading = (Math.random() * 2 * Math.PI);
            const rise    = (Math.random() * Math.PI / 2);
            shard.life  = LightLaneTuning.SHARD_LIFE;
            shard.x     = at[0];
            shard.y     = at[1];
            shard.z     = at[2];
            shard.vx    = (Math.cos(heading) * Math.cos(rise) * speed);
            shard.vy    = (Math.sin(rise) * speed);
            shard.vz    = (Math.sin(heading) * Math.cos(rise) * speed);
            shard.spin  = ((Math.random() - 0.5) * 2 * LightLaneTuning.SHARD_SPIN);
            shard.angle = 0;
            left--;
        }
    }

    /**
     * @param {number} value - the light boost, back to 0 in FLASH_TIME
     */
    flash(value) {
        this._flash     = LightLaneTuning.FLASH_TIME;
        this._flashFrom = value;
    }

    /**
     * @param {{amplitude: number, time: number}} shake
     */
    shake(shake) {
        this._shake.amplitude = shake.amplitude;
        this._shake.time      = shake.time;
        this._shake.left      = shake.time;
    }

    /**
     * @param {number}   dt
     * @param {Engine3d} engine - its light boost set
     */
    update(dt, engine) {
        for (const shard of this._shards) {
            if (shard.life <= 0) {
                continue;
            }
            shard.life   -= dt;
            shard.vy     -= (LightLaneTuning.SHARD_GRAVITY * dt);
            shard.x      += (shard.vx * dt);
            shard.y      += (shard.vy * dt);
            shard.z      += (shard.vz * dt);
            shard.angle  += (shard.spin * dt);
        }
        this._flash = Math.max(0, (this._flash - dt));
        engine.setLightBoost(this._flashFrom * (this._flash / LightLaneTuning.FLASH_TIME));
        const shake = this._shake;
        shake.left  = Math.max(0, (shake.left - dt));
        const amplitude = ((shake.time > 0) ? (shake.amplitude * (shake.left / shake.time)) : 0);
        this.offset[0] = ((Math.random() - 0.5) * 2 * amplitude);
        this.offset[1] = ((Math.random() - 0.5) * 2 * amplitude);
        this.offset[2] = 0;
    }

    /**
     * @param {Engine3d} engine
     */
    draw(engine) {
        for (const shard of this._shards) {
            if (shard.life <= 0) {
                continue;
            }
            shard.instance.placeAt(shard.x, shard.y, shard.z);
            shard.instance.setRotation([shard.angle, shard.angle * LightLaneEffects.SPIN_SKEW, 0]);
            shard.instance.setRenderLight(shard.life / LightLaneTuning.SHARD_LIFE);
            engine.drawInstance(shard.instance);
        }
    }
}

// The second axis of a shard's spin turns at this share of the first.
LightLaneEffects.SPIN_SKEW = 0.7;
