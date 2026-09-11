// Deterministic simulation. The renderer advances this at 120 Hz in logical pixels.
export const VERSION = "gpt6_astra";
export const PHASE_COOLDOWN = 10;
export const PHASE_DURATION = 0.6;
export const ASTEROIDS_PER_LEVEL = 10;
// o3-mini's 60 Hz curve, expressed in seconds instead of render frames.
export const difficultyAt = (level) => ({
  speed: (2 + (level - 1) * 0.5) * 60,
  spawnRate: (0.02 + (level - 1) * 0.005) * 60,
});
export const SECTORS = [
  "Event horizon",
  "The shattered belt",
  "Solar tempest",
  "Into the unknown",
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
    this.phaseLeft = 0;
    this.cooldown = 0;
    this.invulnerable = 0;
    this.asteroids = [];
    this.pickups = [];
    this.warnings = [];
    this.events = [];
    this.spawnIn = 0.7;
    this.pickupIn = 1.5;
    this.repairIn = 14;
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
    });
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
    for (const o of [...this.asteroids, ...this.pickups]) {
      o.x *= sx;
      o.y *= sy;
      o.radius *= sr;
      o.speed *= sy;
      o.drift = (o.drift || 0) * sx;
    }
    for (const warning of this.warnings) {
      warning.x *= sx;
      warning.endX *= sx;
    }
  }
  spawnAsteroid(options = {}) {
    const s = this.scale;
    const rock = {
      x: 30 * s + this.random() * (this.width - 60 * s),
      y: -50 * s,
      radius: ((10 + this.random() * 15) * this.width) / 800,
      speed: (difficultyAt(this.level).speed * this.height) / 600,
      drift: 0,
      rotation: this.random() * Math.PI * 2,
      spin: (this.random() - 0.5) * 1.5,
      shape: Array.from({ length: 10 }, () => 0.77 + this.random() * 0.23),
      hit: false,
      passed: false,
      kind: "rock",
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
  warnMeteor() {
    // A comet replaces a regular spawn; it never adds a bonus wall of hazards.
    const x = (0.06 + this.random() * 0.88) * this.width;
    this.warnings.push({ x, endX: x, left: 1.3, duration: 1.3 });
    this.events.push({
      type: "warning",
      text: "COMET INBOUND · WATCH THE TRAIL",
    });
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
    this.player.vx = (this.player.x - oldX) / dt;
    this.player.vy = (this.player.y - oldY) / dt;
    this.player.lean +=
      (this.player.vx / speed - this.player.lean) * (1 - Math.exp(-14 * dt));

    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      if (this.level >= 8 && this.random() < 0.1 && this.warnings.length < 2)
        this.warnMeteor();
      else this.spawnAsteroid();
      // Exponential spacing reproduces the original random stream independently
      // of display refresh rate. The small floor avoids unreadable clumps.
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
    for (const warning of this.warnings) {
      warning.left -= dt;
      if (warning.left <= 0 && !warning.fired) {
        warning.fired = true;
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
    this.warnings = this.warnings.filter((w) => !w.fired);
    for (const rock of this.asteroids) {
      if (rock.destroyed) continue;
      const rx = rock.x,
        ry = rock.y;
      rock.y += rock.speed * dt;
      rock.x += rock.drift * dt;
      rock.rotation += rock.spin * dt;
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
    // Check swept collisions before exits, including a rock that traverses the
    // entire playfield in one update at extreme levels.
    if (this.status === "playing")
      for (const rock of this.asteroids) {
        if (!rock.destroyed && rock.y - rock.radius > this.height) {
          if (!rock.hit) this.clearAsteroid();
          rock.destroyed = true;
        }
      }
    this.asteroids = this.asteroids.filter(
      (r) =>
        !r.destroyed &&
        r.y < this.height + 100 &&
        r.x > -150 &&
        r.x < this.width + 150,
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
