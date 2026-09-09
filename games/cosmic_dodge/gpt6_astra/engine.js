// Pure simulation: all movement and scoring use a fixed timestep in the controller.
export const VERSION = 'gpt6_astra';
export const PHASE_COOLDOWN = 6;
export const PHASE_DURATION = 0.9;
export const SECTORS = ['Quiet orbit', 'The drift', 'Debris field', 'Deep space'];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function generator(seed) {
  let value = seed >>> 0 || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

export class Flight {
  constructor({ width = 960, height = 640, seed = 1 } = {}) {
    this.width = width;
    this.height = height;
    this.random = generator(seed);
    this.status = 'ready';
    this.elapsed = 0;
    this.bonus = 0;
    this.hp = 3;
    this.combo = 1;
    this.comboLeft = 0;
    this.nearMisses = 0;
    this.starlight = 0;
    this.phaseLeft = 0;
    this.cooldown = 0;
    this.invulnerable = 0;
    this.asteroids = [];
    this.pickups = [];
    this.events = [];
    this.spawnIn = 0.45;
    this.pickupIn = 2;
    this.repairIn = 19;
    this.player = { x: width / 2, y: height - 72, radius: 12, lean: 0 };
  }

  get score() { return Math.floor(this.elapsed * 20 + 1e-8) + this.bonus; }
  get level() { return Math.floor(this.elapsed / 18) + 1; }
  get distance() { return Math.floor(this.elapsed * 140); }
  start() { if (this.status === 'ready') this.status = 'playing'; }
  pause() { if (this.status === 'playing') this.status = 'paused'; }
  resume() { if (this.status === 'paused') this.status = 'playing'; }
  phase() {
    if (this.status !== 'playing' || this.cooldown > 0) return false;
    this.phaseLeft = PHASE_DURATION;
    this.cooldown = PHASE_COOLDOWN;
    this.events.push({ type: 'phase', x: this.player.x, y: this.player.y });
    return true;
  }
  resize(width, height) {
    const sx = width / this.width;
    const sy = height / this.height;
    this.player.x = clamp(this.player.x * sx, 22, width - 22);
    this.player.y = height - 72;
    for (const object of [...this.asteroids, ...this.pickups]) {
      object.x *= sx;
      object.y *= sy;
    }
    this.width = width;
    this.height = height;
  }
  spawnAsteroid() {
    const radius = 16 + this.random() * 21;
    this.asteroids.push({
      x: 35 + this.random() * (this.width - 70), y: -radius - 8, radius,
      speed: 165 + Math.min(this.level, 18) * 18 + this.random() * 55,
      drift: (this.random() - 0.5) * 30,
      rotation: this.random() * Math.PI * 2,
      spin: (this.random() - 0.5) * 1.2,
      shape: Array.from({ length: 9 }, () => 0.76 + this.random() * 0.24),
      passed: false, hit: false
    });
  }
  spawnPickup(type = 'star') {
    this.pickups.push({
      x: 35 + this.random() * (this.width - 70), y: -20,
      radius: type === 'repair' ? 13 : 10,
      speed: 180 + Math.min(this.level, 18) * 12, type
    });
  }
  update(dt, { axis = 0, target = null } = {}) {
    if (this.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    const previousLevel = this.level;
    this.elapsed += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.phaseLeft = Math.max(0, this.phaseLeft - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.comboLeft = Math.max(0, this.comboLeft - dt);
    if (!this.comboLeft) this.combo = 1;
    if (this.level !== previousLevel) this.events.push({ type: 'sector', level: this.level });

    const oldX = this.player.x;
    const speed = Math.min(560, this.width * 1.05);
    if (axis) this.player.x += clamp(axis, -1, 1) * speed * dt;
    else if (Number.isFinite(target)) this.player.x += clamp(target - this.player.x, -speed * dt, speed * dt);
    this.player.x = clamp(this.player.x, 22, this.width - 22);
    this.player.lean += ((this.player.x - oldX) / Math.max(1, speed * dt) - this.player.lean) * Math.min(1, dt * 12);

    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawnAsteroid();
      this.spawnIn += Math.max(0.24, 0.73 - this.level * 0.031) * (960 / this.width) ** 0.35;
    }
    this.pickupIn -= dt;
    if (this.pickupIn <= 0) { this.spawnPickup(); this.pickupIn += 2.25; }
    this.repairIn -= dt;
    if (this.repairIn <= 0) { this.spawnPickup('repair'); this.repairIn += 22; }

    for (const rock of this.asteroids) {
      const previousY = rock.y;
      rock.y += rock.speed * dt;
      rock.x += rock.drift * dt;
      rock.rotation += rock.spin * dt;
      const dx = rock.x - this.player.x;
      const dy = rock.y - this.player.y;
      const hitRadius = rock.radius * 0.82 + this.player.radius;
      if (!rock.hit && Math.hypot(dx, dy) < hitRadius) {
        rock.hit = true;
        if (this.phaseLeft > 0) {
          this.events.push({ type: 'pass', x: rock.x, y: rock.y });
        } else if (this.invulnerable <= 0) {
          this.hp--;
          this.invulnerable = 1.4;
          this.combo = 1;
          this.comboLeft = 0;
          this.events.push({ type: 'hit', x: this.player.x, y: this.player.y });
          if (this.hp <= 0) {
            this.status = 'over';
            this.events.push({ type: 'over', score: this.score });
            break;
          }
        }
      }
      if (!rock.passed && previousY < this.player.y && rock.y >= this.player.y) {
        rock.passed = true;
        if (!rock.hit && !this.phaseLeft && !this.invulnerable && Math.abs(dx) < hitRadius + 32 && Math.abs(dx) >= hitRadius) {
          this.nearMisses++;
          this.combo = Math.min(5, this.combo + 1);
          this.comboLeft = 5;
          const points = 60 * this.combo;
          this.bonus += points;
          this.events.push({ type: 'near', x: this.player.x, y: this.player.y - 45, points, combo: this.combo });
        }
      }
    }
    this.asteroids = this.asteroids.filter(rock => rock.y < this.height + 70);
    if (this.status !== 'playing') return;
    for (const pickup of this.pickups) {
      pickup.y += pickup.speed * dt;
      if (Math.hypot(pickup.x - this.player.x, pickup.y - this.player.y) < pickup.radius + 20) {
        pickup.collected = true;
        if (pickup.type === 'repair') this.hp = Math.min(3, this.hp + 1);
        else { this.starlight++; this.bonus += 50 * this.combo; }
        this.events.push({ type: pickup.type, x: pickup.x, y: pickup.y, points: 50 * this.combo });
      }
    }
    this.pickups = this.pickups.filter(p => !p.collected && p.y < this.height + 30);
  }
  drainEvents() { return this.events.splice(0); }
}
