// Deterministic simulation. The renderer advances this at 120 Hz in logical pixels.
export const VERSION = "grok_4_6";
export const PHASE_COOLDOWN = 10;
export const PHASE_DURATION = 0.6;
export const ASTEROIDS_PER_LEVEL = 10;
export const NEAR_MISS_REFUND = 1.6;
export const WELL_CORE = 16;
export const WELL_PULL = 118;
// o3-mini's 60 Hz curve, expressed in seconds instead of render frames.
export const difficultyAt = (level) => ({
  speed: (2 + (level - 1) * 0.5) * 60,
  spawnRate: (0.02 + (level - 1) * 0.005) * 60,
});
export const SECTORS = [
  "Clear signal",
  "The iron belt",
  "Gold storm",
  "Maximum truth",
];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function generator(seed) {
  let n = seed >>> 0 || 1;
  return () => {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    return (n >>> 0) / 4294967296;
  };
}
// Distance from the origin to a moving object's relative-position segment.
export function sweptDistance(ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    length = dx * dx + dy * dy;
  const t = length ? clamp(-(ax * dx + ay * dy) / length, 0, 1) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}
export class Flight {
  constructor({ width = 960, height = 640, seed = 1 } = {}) {
    this.width = width;
    this.height = height;
    this.random = generator(seed);
    this.status = "ready";
    this.elapsed = 0;
    this.bonus = 0;
    this.hp = 1;
    this.cleared = 0;
    this.dodged = 0;
    this.combo = 1;
    this.comboLeft = 0;
    this.nearMisses = 0;
    this.starlight = 0;
    this.slingshots = 0;
    this.phaseLeft = 0;
    this.cooldown = 0;
    this.invulnerable = 0;
    this.asteroids = [];
    this.pickups = [];
    this.warnings = [];
    this.wells = [];
    this.events = [];
    this.spawnIn = 0.7;
    this.pickupIn = 1.5;
    this.repairIn = 14;
    this.wellIn = 7;
    this.destroyed = 0;
    this.player = {
      x: width / 2,
      y: height * 0.76,
      radius: 10 * this.scale,
      lean: 0,
      vx: 0,
      vy: 0,
    };
  }
  get scale() {
    return clamp(Math.min(this.width, this.height) / 640, 0.52, 1.4);
  }
  get bounds() {
    const s = this.scale;
    return {
      left: 25 * s,
      right: this.width - 25 * s,
      top: Math.min(Math.max(100, 120 * s), this.height * 0.3),
      bottom: this.height - Math.max(95, 90 * s),
    };
  }
  get score() {
    return this.cleared;
  }
  get level() {
    return Math.floor(this.cleared / ASTEROIDS_PER_LEVEL) + 1;
  }
  get levelProgress() {
    return this.cleared % ASTEROIDS_PER_LEVEL;
  }
  get distance() {
    return Math.floor(this.elapsed * 180);
  }
  get sectorIndex() {
    return Math.min(SECTORS.length - 1, Math.floor((this.level - 1) / 10));
  }
  start() {
    if (this.status === "ready") this.status = "playing";
  }
  pause() {
    if (this.status === "playing") this.status = "paused";
  }
  resume() {
    if (this.status === "paused") this.status = "playing";
  }
  phase() {
    if (this.status !== "playing" || this.cooldown > 0) return false;
    this.phaseLeft = PHASE_DURATION;
    this.cooldown = PHASE_COOLDOWN;
    this.events.push({ type: "phase", x: this.player.x, y: this.player.y });
    for (const rock of this.asteroids) {
      if (
        !rock.hit &&
        Math.hypot(rock.x - this.player.x, rock.y - this.player.y) <
          115 * this.scale + rock.radius
      )
        this.shatter(rock);
    }
    return true;
  }
  shatter(rock) {
    if (rock.hit || rock.destroyed) return;
    rock.hit = true;
    rock.destroyed = true;
    this.destroyed++;
    this.clearAsteroid(false);
    this.bonus += 25;
    this.events.push({
      type: "shatter",
      x: rock.x,
      y: rock.y,
      radius: rock.radius,
      points: 25,
      kind: rock.kind,
    });
    if (rock.kind === "cluster") this.splitCluster(rock);
  }
  splitCluster(rock) {
    const s = this.scale;
    for (const side of [-1, 1]) {
      const child = this.spawnAsteroid({
        x: rock.x + side * (rock.radius + 10 * s),
        y: rock.y,
        radius: Math.max(8 * s, rock.radius * 0.52),
        speed: rock.speed * 1.05,
        drift: (rock.drift || 0) + side * this.width * 0.08,
        kind: "shard",
        rotation: rock.rotation + side,
      });
      if (
        this.phaseLeft > 0 &&
        Math.hypot(child.x - this.player.x, child.y - this.player.y) <
          115 * s + child.radius
      )
        this.shatter(child);
    }
  }
  clearAsteroid(dodged = true) {
    const before = this.level;
    this.cleared++;
    if (dodged) this.dodged++;
    if (this.level !== before)
      this.events.push({ type: "level", level: this.level });
  }
  resize(width, height) {
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < 100 ||
      height < 100
    )
      return;
    const sx = width / this.width,
      sy = height / this.height,
      oldScale = this.scale;
    this.width = width;
    this.height = height;
    const sr = this.scale / oldScale,
      b = this.bounds;
    this.player.x = clamp(this.player.x * sx, b.left, b.right);
    this.player.y = clamp(this.player.y * sy, b.top, b.bottom);
    this.player.radius = 10 * this.scale;
    for (const o of [...this.asteroids, ...this.pickups, ...this.wells]) {
      o.x *= sx;
      o.y *= sy;
      o.radius *= sr;
      if (o.speed) o.speed *= sy;
      o.drift = (o.drift || 0) * sx;
    }
    for (const warning of this.warnings) {
      warning.x *= sx;
      warning.endX *= sx;
      if (warning.y != null) warning.y *= sy;
    }
  }
  spawnAsteroid(options = {}) {
    const s = this.scale;
    const sector = this.sectorIndex;
    const iron = sector >= 1 && this.random() < 0.28;
    const cluster =
      this.level >= 6 && !options.kind && this.random() < 0.16;
    const ice = sector >= 2 && !iron && !cluster && this.random() < 0.22;
    let kind = options.kind;
    if (!kind) kind = cluster ? "cluster" : iron ? "iron" : ice ? "ice" : "rock";
    const radiusMul = kind === "iron" ? 1.35 : kind === "ice" ? 0.72 : kind === "cluster" ? 1.22 : 1;
    const speedMul = kind === "iron" ? 0.82 : kind === "ice" ? 1.28 : 1;
    const rock = {
      x: 30 * s + this.random() * (this.width - 60 * s),
      y: -50 * s,
      radius: ((10 + this.random() * 15) * this.width * radiusMul) / 800,
      speed: (difficultyAt(this.level).speed * this.height * speedMul) / 600,
      drift: (kind === "ice" ? (this.random() - 0.5) * this.width * 0.12 : 0),
      rotation: this.random() * Math.PI * 2,
      spin: (this.random() - 0.5) * 1.5,
      shape: Array.from({ length: 10 }, () => 0.77 + this.random() * 0.23),
      hit: false,
      passed: false,
      kind,
      ...options,
    };
    this.asteroids.push(rock);
    return rock;
  }
  spawnPickup(type = "star", x = null, y = -20) {
    this.pickups.push({
      x: x ?? 30 * this.scale + this.random() * (this.width - 60 * this.scale),
      y,
      radius: (type === "repair" ? 13 : 9) * this.scale,
      speed: this.height / 3.7,
      type,
    });
  }
  spawnWell() {
    if (this.wells.length) return null;
    const s = this.scale;
    const well = {
      x: 80 * s + this.random() * (this.width - 160 * s),
      y: -40 * s,
      radius: WELL_CORE * s,
      pull: WELL_PULL * s,
      speed: this.height / 11,
      drift: (this.random() - 0.5) * this.width * 0.04,
      slung: false,
      spin: 0,
    };
    this.wells.push(well);
    this.events.push({ type: "well", x: well.x, y: well.y });
    return well;
  }
  warnMeteor() {
    const x = (0.06 + this.random() * 0.88) * this.width;
    this.warnings.push({
      x,
      endX: x,
      y: 0,
      axis: "v",
      left: 1.3,
      duration: 1.3,
    });
    this.events.push({
      type: "warning",
      text: "COMET INBOUND · READ THE TRAIL",
    });
  }
  warnShear() {
    const y = this.bounds.top + this.random() * (this.bounds.bottom - this.bounds.top);
    const fromLeft = this.random() < 0.5;
    this.warnings.push({
      x: fromLeft ? 0 : this.width,
      endX: fromLeft ? this.width : 0,
      y,
      axis: "h",
      left: 1.15,
      duration: 1.15,
      fromLeft,
    });
    this.events.push({
      type: "warning",
      text: "SOLAR SHEAR · HOLD THE LINE",
    });
  }
  attract(object, well, dt, strength = 1) {
    const dx = well.x - object.x,
      dy = well.y - object.y,
      dist = Math.hypot(dx, dy);
    if (dist < 4 || dist > well.pull) return dist;
    const force = 210 * this.scale * (1 - dist / well.pull) * strength * dt;
    object.x += (dx / dist) * force;
    object.y += (dy / dist) * force;
    return dist;
  }
  update(dt, { axis = 0, vertical = 0, target = null } = {}) {
    if (this.status !== "playing" || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    const oldX = this.player.x,
      oldY = this.player.y,
      s = this.scale;
    this.elapsed += dt;
    for (const key of ["cooldown", "phaseLeft", "invulnerable", "comboLeft"])
      this[key] = Math.max(0, this[key] - dt);
    if (!this.comboLeft) this.combo = 1;

    const speed = this.width * (this.phaseLeft ? 1.2 : 0.95);
    let dx = Number.isFinite(axis) ? clamp(axis, -1, 1) : 0;
    let dy = Number.isFinite(vertical) ? clamp(vertical, -1, 1) : 0;
    if (dx || dy) {
      const length = Math.hypot(dx, dy);
      dx = (dx / length) * speed * dt;
      dy = (dy / length) * speed * dt;
    } else if (target !== null) {
      const tx = typeof target === "number" ? target : target?.x;
      const ty = typeof target === "number" ? this.player.y : target?.y;
      if (Number.isFinite(tx) && Number.isFinite(ty)) {
        dx = tx - oldX;
        dy = ty - oldY;
        const fraction = Math.min(
          1,
          (speed * 1.35 * dt) / Math.max(0.001, Math.hypot(dx, dy)),
        );
        dx *= fraction;
        dy *= fraction;
      }
    }
    const bounds = this.bounds;
    this.player.x = clamp(oldX + dx, bounds.left, bounds.right);
    this.player.y = clamp(oldY + dy, bounds.top, bounds.bottom);

    for (const well of this.wells) {
      this.attract(this.player, well, dt, this.phaseLeft ? 0.35 : 1);
    }
    this.player.x = clamp(this.player.x, bounds.left, bounds.right);
    this.player.y = clamp(this.player.y, bounds.top, bounds.bottom);
    this.player.vx = (this.player.x - oldX) / dt;
    this.player.vy = (this.player.y - oldY) / dt;
    this.player.lean +=
      (this.player.vx / speed - this.player.lean) * (1 - Math.exp(-14 * dt));

    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      if (this.level >= 8 && this.random() < 0.1 && this.warnings.length < 2)
        this.warnMeteor();
      else if (
        this.level >= 12 &&
        this.random() < 0.08 &&
        this.warnings.length < 2
      )
        this.warnShear();
      else this.spawnAsteroid();
      this.spawnIn += Math.max(
        0.06,
        -Math.log(Math.max(0.00001, 1 - this.random())) /
          difficultyAt(this.level).spawnRate,
      );
    }
    this.pickupIn -= dt;
    if (this.pickupIn <= 0) {
      this.spawnPickup();
      this.pickupIn += 2.8;
    }
    this.repairIn -= dt;
    if (this.repairIn <= 0) {
      this.spawnPickup("repair");
      this.repairIn += 22;
    }
    this.wellIn -= dt;
    if (this.wellIn <= 0) {
      if (this.level >= 5 && this.wells.length === 0) this.spawnWell();
      this.wellIn += 9 + this.random() * 6;
    }
    for (const warning of this.warnings) {
      warning.left -= dt;
      if (warning.left <= 0 && !warning.fired) {
        warning.fired = true;
        if (warning.axis === "h") {
          const travel = 0.55;
          this.spawnAsteroid({
            x: warning.fromLeft ? -30 * s : this.width + 30 * s,
            y: warning.y,
            speed: 0,
            drift: ((warning.fromLeft ? 1 : -1) * this.width) / travel,
            radius: (11 * this.width) / 800,
            kind: "shear",
          });
        } else {
          const travel = 600 / (difficultyAt(this.level).speed * 1.3);
          this.spawnAsteroid({
            x: warning.x,
            y: -25 * s,
            speed: this.height / travel,
            drift: (warning.endX - warning.x) / travel,
            radius: (14 * this.width) / 800,
            kind: "meteor",
          });
        }
      }
    }
    this.warnings = this.warnings.filter((w) => !w.fired);
    for (const well of this.wells) {
      well.y += well.speed * dt;
      well.x += well.drift * dt;
      well.spin += dt * 1.4;
      const dist = sweptDistance(
        well.x - oldX,
        well.y - oldY,
        well.x - this.player.x,
        well.y - this.player.y,
      );
      if (dist < well.radius + this.player.radius) {
        if (this.phaseLeft > 0) continue;
        if (this.invulnerable <= 0) {
          this.hp--;
          this.invulnerable = 1.2;
          this.combo = 1;
          this.comboLeft = 0;
          this.events.push({ type: "hit", x: this.player.x, y: this.player.y });
          if (this.hp <= 0) {
            this.status = "over";
            this.events.push({ type: "over", score: this.score });
            break;
          }
        }
      } else if (
        !well.slung &&
        dist < well.pull * 0.58 &&
        dist > well.radius + 10 * s &&
        !this.phaseLeft &&
        !this.invulnerable
      ) {
        well.slung = true;
        this.slingshots++;
        this.combo = Math.min(5, this.combo + 1);
        this.comboLeft = 5;
        const points = 80 * this.combo;
        this.bonus += points;
        this.cooldown = Math.max(0, this.cooldown - NEAR_MISS_REFUND);
        this.events.push({
          type: "slingshot",
          x: this.player.x,
          y: this.player.y - 36 * s,
          points,
          combo: this.combo,
        });
      }
    }
    if (this.status !== "playing") return;
    this.wells = this.wells.filter(
      (w) => w.y < this.height + 80 && w.x > -120 && w.x < this.width + 120,
    );
    for (const rock of this.asteroids) {
      if (rock.destroyed) continue;
      const rx = rock.x,
        ry = rock.y;
      rock.y += rock.speed * dt;
      rock.x += rock.drift * dt;
      rock.rotation += rock.spin * dt;
      for (const well of this.wells) this.attract(rock, well, dt, 0.85);
      const distance = sweptDistance(
        rx - oldX,
        ry - oldY,
        rock.x - this.player.x,
        rock.y - this.player.y,
      );
      const hitRadius = rock.radius * 0.78 + this.player.radius;
      if (!rock.hit && this.phaseLeft > 0 && distance < hitRadius + 15 * s) {
        this.shatter(rock);
        continue;
      }
      if (!rock.hit && distance < hitRadius) {
        rock.hit = true;
        if (this.invulnerable <= 0) {
          this.hp--;
          this.invulnerable = 1.2;
          this.combo = 1;
          this.comboLeft = 0;
          this.events.push({ type: "hit", x: this.player.x, y: this.player.y });
          if (this.hp <= 0) {
            this.status = "over";
            this.events.push({ type: "over", score: this.score });
            break;
          }
        }
      }
      if (!rock.passed && ry - oldY < 0 && rock.y - this.player.y >= 0) {
        rock.passed = true;
        if (
          !rock.hit &&
          !this.phaseLeft &&
          !this.invulnerable &&
          distance >= hitRadius &&
          distance < hitRadius + 28 * s
        ) {
          this.nearMisses++;
          this.combo = Math.min(5, this.combo + 1);
          this.comboLeft = 5;
          this.cooldown = Math.max(0, this.cooldown - NEAR_MISS_REFUND);
          const points = 60 * this.combo;
          this.bonus += points;
          this.events.push({
            type: "near",
            x: this.player.x,
            y: this.player.y - 40 * s,
            points,
            combo: this.combo,
          });
        }
      }
    }
    if (this.status === "playing")
      for (const rock of this.asteroids) {
        const offBottom = rock.y - rock.radius > this.height;
        const offSide =
          rock.kind === "shear" &&
          (rock.x < -80 || rock.x > this.width + 80);
        if (!rock.destroyed && (offBottom || offSide)) {
          if (!rock.hit) this.clearAsteroid();
          rock.destroyed = true;
        }
      }
    this.asteroids = this.asteroids.filter(
      (r) =>
        !r.destroyed &&
        r.y < this.height + 100 &&
        r.x > -180 &&
        r.x < this.width + 180,
    );
    if (this.status !== "playing") return;
    for (const pickup of this.pickups) {
      const px = pickup.x,
        py = pickup.y;
      pickup.y += pickup.speed * dt;
      const distance = Math.hypot(
        pickup.x - this.player.x,
        pickup.y - this.player.y,
      );
      if (distance < (this.phaseLeft ? 160 : 68) * s && distance > 1) {
        const pull = Math.min(1, dt * 9);
        pickup.x += (this.player.x - pickup.x) * pull;
        pickup.y += (this.player.y - pickup.y) * pull;
      }
      if (
        sweptDistance(
          px - oldX,
          py - oldY,
          pickup.x - this.player.x,
          pickup.y - this.player.y,
        ) <
        pickup.radius + this.player.radius + 8 * s
      ) {
        pickup.collected = true;
        const points = pickup.type === "star" ? 50 * this.combo : 0;
        if (pickup.type === "repair") this.hp = Math.min(2, this.hp + 1);
        else {
          this.starlight++;
          this.bonus += points;
        }
        this.events.push({
          type: pickup.type,
          x: pickup.x,
          y: pickup.y,
          points,
        });
      }
    }
    this.pickups = this.pickups.filter(
      (p) => !p.collected && p.y < this.height + 40,
    );
  }
  drainEvents() {
    return this.events.splice(0);
  }
}
