// Banana Survivors — Claude Fable 5.2 edition: "Peel Out".
// Nobody gets shot. You throw peels, monkeys slip, and a slipping monkey
// bowls over the monkeys behind it. Deterministic: one seed, fixed steps.
import { rng, clamp } from "../../../js/fable/kit.js?v=1";

export const VERSION = "claude_fable_5_2";
export const RULESET = 1;
export const STEP = 1 / 60;
export const ARENA = 2200;
export const MAX_ENEMIES = 230;

export const TYPES = {
  monkey: { r: 15, hp: 22, speed: 92, dmg: 9, mass: 1, xp: 1, points: 10 },
  baby: { r: 10, hp: 9, speed: 138, dmg: 5, mass: 0.5, xp: 1, points: 6 },
  thrower: { r: 15, hp: 26, speed: 80, dmg: 8, mass: 1, xp: 2, points: 18 },
  gorilla: { r: 27, hp: 150, speed: 62, dmg: 18, mass: 3.2, xp: 6, points: 60 },
  boss: { r: 48, hp: 900, speed: 70, dmg: 26, mass: 30, xp: 40, points: 1000 },
};

/** Every upgrade: what the card says and what a rank does. */
export const UPGRADES = [
  { id: "quick", name: "Quick wrists", text: "Throw peels 15% more often.", max: 6, apply: (s) => (s.throwEvery *= 0.85) },
  { id: "bunch", name: "Whole bunch", text: "Throw one more peel each time.", max: 4, apply: (s) => s.peels++ },
  { id: "slick", name: "Extra slick", text: "Slipped monkeys slide 20% faster and further.", max: 5, apply: (s) => (s.slidePower *= 1.2) },
  { id: "domino", name: "Domino theory", text: "Tumbles pass one monkey further and lose less speed.", max: 4, apply: (s) => (s.chainDepth++, (s.chainKeep = Math.min(0.92, s.chainKeep + 0.05))) },
  { id: "bruise", name: "Hard landing", text: "Every tumble hurts 30% more.", max: 6, apply: (s) => (s.damage *= 1.3) },
  { id: "ripe", name: "Overripe", text: "Every few peels bursts and trips everything close by.", max: 3, apply: (s) => (s.ripeEvery = s.ripeEvery ? s.ripeEvery - 1 : 4) },
  { id: "litter", name: "Litterbug", text: "Drop a peel behind you as you run.", max: 3, apply: (s) => (s.litterEvery = s.litterEvery ? s.litterEvery * 0.72 : 2) },
  { id: "coconut", name: "Shake the trees", text: "Crashing into a palm brings down more coconuts.", max: 3, apply: (s) => s.coconuts++ },
  { id: "sneakers", name: "Good sneakers", text: "Run 10% faster.", max: 4, apply: (s) => (s.speed *= 1.1) },
  { id: "hearty", name: "Thick skin", text: "25 more health, and heal 25 now.", max: 4, apply: (s, g) => ((s.maxHp += 25), (g.player.hp = Math.min(s.maxHp, g.player.hp + 25))) },
  { id: "smoothie", name: "Smoothie", text: "Slowly heal while you survive.", max: 3, apply: (s) => (s.regen += 0.7) },
  { id: "magnet", name: "Sticky fingers", text: "Pick up drops from 40% further away.", max: 3, apply: (s) => (s.magnet *= 1.4) },
  { id: "slide", name: "Slip and slide", text: "Dash again sooner and leave three peels behind.", max: 3, apply: (s) => ((s.dashEvery *= 0.78), (s.dashPeels += 3)) },
  { id: "golden", name: "Golden peel", text: "Some peels are golden and hit three times as hard.", max: 3, apply: (s) => (s.golden += 0.12) },
];
const BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export const xpForLevel = (level) => 4 + level * 3 + Math.floor(level * level * 0.25);
export const hpScaleAt = (t) => 1 + t / 55 + (t / 150) ** 2;
export const COMBOS = [
  [5, "Domino!"],
  [10, "Strike!"],
  [18, "Pile-up!"],
  [30, "Bananageddon!"],
];

export class Game {
  constructor({ seed = 1 } = {}) {
    this.seed = seed >>> 0;
    this.random = rng(this.seed);
    this.status = "playing"; // playing | choosing | over
    this.time = 0;
    this.points = 0;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.bestChain = 0;
    this.bossesDown = 0;
    this.stats = {
      throwEvery: 0.95, peels: 1, range: 440, slidePower: 520, damage: 14, chainKeep: 0.7, chainDepth: 3,
      ripeEvery: 0, litterEvery: 0, coconuts: 1, speed: 205, maxHp: 100, regen: 0, magnet: 95, dashEvery: 2.6, dashPeels: 0, golden: 0,
    };
    this.ranks = {};
    this.player = { x: ARENA / 2, y: ARENA / 2, vx: 0, vy: 0, r: 15, hp: 100, hurt: 0, dash: 0, dashCd: 0, dashX: 0, dashY: 1, faceX: 0, faceY: 1 };
    this.enemies = [];
    this.peels = []; // flying or lying
    this.orbs = [];
    this.coconuts = []; // falling: land after `t`
    this.chains = new Map(); // chain id -> kills
    this.events = [];
    this.choices = [];
    this.pendingLevels = 0;
    this.nextId = 1;
    this.throwIn = 0.6;
    this.litterIn = 0;
    this.thrown = 0;
    this.spawnIn = 0.4;
    this.bossAt = 120;
    this.trees = [];
    for (let tries = 0; this.trees.length < 30 && tries < 600; tries++) {
      const x = 140 + this.random() * (ARENA - 280),
        y = 140 + this.random() * (ARENA - 280);
      if (Math.hypot(x - ARENA / 2, y - ARENA / 2) > 190 && this.trees.every((t) => Math.hypot(t.x - x, t.y - y) > 210))
        this.trees.push({ x, y, r: 24, shake: 0 });
    }
    this.grid = new Map();
  }
  get score() {
    return Math.floor(this.points + this.time * 2);
  }
  drainEvents() {
    return this.events.splice(0);
  }

  /* ---------------------------------------------------------- upgrades */
  offer(count = 3) {
    const pool = UPGRADES.filter((u) => (this.ranks[u.id] ?? 0) < u.max),
      picks = [];
    while (picks.length < count && pool.length) picks.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
    return picks.map((u) => ({ id: u.id, name: u.name, text: u.text, rank: (this.ranks[u.id] ?? 0) + 1, max: u.max }));
  }
  grant(id) {
    const u = BY_ID[id];
    if (!u || (this.ranks[id] ?? 0) >= u.max) return false;
    this.ranks[id] = (this.ranks[id] ?? 0) + 1;
    u.apply(this.stats, this);
    return true;
  }
  choose(index) {
    if (this.status !== "choosing") return false;
    const pick = this.choices[index];
    if (!pick) return false;
    this.grant(pick.id);
    this.events.push({ type: "upgrade", id: pick.id, name: pick.name });
    this.pendingLevels--;
    this.levelCheck();
    return true;
  }
  levelCheck() {
    if (this.pendingLevels > 0) {
      this.choices = this.offer();
      if (this.choices.length) {
        this.status = "choosing";
        return;
      }
      this.pendingLevels = 0; // everything is maxed: heal instead
      this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 15);
    }
    this.status = "playing";
  }
  gainXp(amount) {
    this.xp += amount;
    while (this.xp >= xpForLevel(this.level)) {
      this.xp -= xpForLevel(this.level);
      this.level++;
      this.pendingLevels++;
      this.events.push({ type: "level", level: this.level });
    }
    if (this.pendingLevels && this.status === "playing") this.levelCheck();
  }

  /* ----------------------------------------------------------- helpers */
  near(x, y, radius, fn) {
    const c = 80,
      x0 = Math.floor((x - radius) / c),
      x1 = Math.floor((x + radius) / c),
      y0 = Math.floor((y - radius) / c),
      y1 = Math.floor((y + radius) / c);
    for (let gx = x0; gx <= x1; gx++)
      for (let gy = y0; gy <= y1; gy++) {
        const cell = this.grid.get(gx * 4096 + gy);
        if (cell) for (const e of cell) fn(e);
      }
  }
  spawn(type, x, y, scale = hpScaleAt(this.time)) {
    const T = TYPES[type],
      e = {
        id: this.nextId++, type, x, y, r: T.r, hp: T.hp * scale, maxHp: T.hp * scale, speed: T.speed * (0.9 + this.random() * 0.2),
        dmg: T.dmg * (1 + this.time / 240), mass: T.mass, state: "walk", sx: 0, sy: 0, depth: 0, chain: 0, t: 0, cool: 1 + this.random() * 2, wob: this.random() * 6.28,
      };
    if (type === "boss") Object.assign(e, { phase: "stalk", phaseT: 3, cx: 0, cy: 0 });
    this.enemies.push(e);
    return e;
  }
  /** Sends an enemy sliding. Returns false for anything too heavy to tip. */
  slip(e, dx, dy, power, depth, chain) {
    if (e.state === "ko") return false;
    const n = Math.hypot(dx, dy) || 1;
    if (e.type === "boss") {
      this.hurt(e, this.stats.damage * 0.6, chain);
      return false;
    }
    e.state = "slide";
    e.sx = ((dx / n) * power) / Math.sqrt(e.mass);
    e.sy = ((dy / n) * power) / Math.sqrt(e.mass);
    e.depth = depth;
    e.chain = chain;
    e.t = 0;
    e.hit = null;
    this.events.push({ type: "slip", x: e.x, y: e.y, depth });
    return true;
  }
  hurt(e, amount, chain = 0) {
    if (e.state === "ko") return;
    e.hp -= amount;
    e.flash = 0.12;
    if (e.hp > 0) return;
    const T = TYPES[e.type];
    e.state = "ko";
    e.t = 0;
    this.kills++;
    let n = 1;
    if (chain) {
      n = (this.chains.get(chain) ?? 0) + 1;
      this.chains.set(chain, n);
      this.bestChain = Math.max(this.bestChain, n);
      for (const [at, label] of COMBOS)
        if (n === at) {
          this.points += at * 20;
          this.events.push({ type: "combo", n, label, x: e.x, y: e.y });
        }
    }
    this.points += T.points * (1 + (n - 1) * 0.1);
    this.orbs.push({ x: e.x, y: e.y, v: T.xp, t: 0 });
    this.events.push({ type: "ko", x: e.x, y: e.y, kind: e.type, n });
    if (e.type === "boss") {
      this.bossesDown++;
      this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 30);
      this.pendingLevels += 2;
      this.events.push({ type: "bossDown" });
      if (this.status === "playing") this.levelCheck();
    }
  }
  dropPeel(x, y, { vx = 0, vy = 0, flying = false } = {}) {
    this.thrown++;
    const s = this.stats,
      ripe = !!s.ripeEvery && this.thrown % s.ripeEvery === 0,
      golden = !ripe && this.random() < s.golden;
    this.peels.push({ x, y, vx, vy, flying, life: flying ? 0.9 : 9, ripe, golden, spin: this.random() * 6 });
  }
  burst(x, y, radius, chain) {
    this.events.push({ type: "burst", x, y, r: radius });
    this.near(x, y, radius + 30, (e) => {
      const d = Math.hypot(e.x - x, e.y - y);
      if (e.state !== "ko" && d < radius + e.r) {
        this.hurt(e, this.stats.damage * 0.8, chain);
        if (e.state !== "ko") this.slip(e, e.x - x || 1, e.y - y, this.stats.slidePower * 0.8, 1, chain);
      }
    });
  }

  /* ------------------------------------------------------------- frame */
  update(dt, input = {}) {
    if (this.status !== "playing" || !(dt > 0)) return;
    dt = Math.min(dt, 0.05);
    const p = this.player,
      s = this.stats,
      R = this.random;
    this.time += dt;

    // --- the banana ---
    let ix = clamp(Number(input.x) || 0, -1, 1),
      iy = clamp(Number(input.y) || 0, -1, 1);
    const im = Math.hypot(ix, iy);
    if (im > 1) {
      ix /= im;
      iy /= im;
    }
    if (im > 0.05) {
      p.faceX = ix / (im > 1 ? 1 : im);
      p.faceY = iy / (im > 1 ? 1 : im);
    }
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    if (input.dash && p.dashCd <= 0 && p.dash <= 0) {
      p.dash = 0.24;
      p.dashCd = s.dashEvery;
      p.dashX = p.faceX;
      p.dashY = p.faceY;
      p.dashChain = this.nextId++;
      this.events.push({ type: "dash" });
      for (let i = 0; i < s.dashPeels; i++) this.dropPeel(p.x - p.dashX * 26 * i, p.y - p.dashY * 26 * i);
    }
    if (p.dash > 0) {
      p.dash -= dt;
      p.vx = p.dashX * s.speed * 3.4;
      p.vy = p.dashY * s.speed * 3.4;
    } else {
      const k = 1 - Math.exp(-16 * dt);
      p.vx += (ix * s.speed - p.vx) * k;
      p.vy += (iy * s.speed - p.vy) * k;
    }
    p.x = clamp(p.x + p.vx * dt, 30, ARENA - 30);
    p.y = clamp(p.y + p.vy * dt, 30, ARENA - 30);
    for (const t of this.trees) {
      const d = Math.hypot(p.x - t.x, p.y - t.y);
      if (d < t.r + p.r && d > 0.01) {
        p.x = t.x + ((p.x - t.x) / d) * (t.r + p.r);
        p.y = t.y + ((p.y - t.y) / d) * (t.r + p.r);
      }
      t.shake = Math.max(0, t.shake - dt);
    }
    if (s.regen) p.hp = Math.min(s.maxHp, p.hp + s.regen * dt);

    // --- grid of everything standing ---
    this.grid.clear();
    for (const e of this.enemies) {
      if (e.state === "ko") continue;
      const key = Math.floor(e.x / 80) * 4096 + Math.floor(e.y / 80);
      let cell = this.grid.get(key);
      if (!cell) this.grid.set(key, (cell = []));
      cell.push(e);
    }

    // --- throwing ---
    this.throwIn -= dt;
    if (this.throwIn <= 0) {
      const targets = [];
      this.near(p.x, p.y, s.range, (e) => {
        if (e.state === "walk" || e.type === "boss") {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < s.range) targets.push([d, e]);
        }
      });
      if (targets.length) {
        targets.sort((a, b) => a[0] - b[0] || a[1].id - b[1].id);
        for (let i = 0; i < s.peels; i++) {
          const [d, e] = targets[Math.min(i, targets.length - 1)],
            spread = i >= targets.length ? (i - targets.length + 1) * 0.22 * (i % 2 ? 1 : -1) : 0,
            a = Math.atan2(e.y - p.y, e.x - p.x) + spread,
            speed = 620;
          this.dropPeel(p.x, p.y, { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, flying: true });
          void d;
        }
        this.events.push({ type: "throw" });
        this.throwIn = s.throwEvery;
      } else this.throwIn = 0.12;
    }
    if (s.litterEvery) {
      this.litterIn -= dt;
      if (this.litterIn <= 0 && im > 0.2) {
        this.litterIn = s.litterEvery;
        this.dropPeel(p.x - p.faceX * 18, p.y - p.faceY * 18);
      }
    }

    // --- peels ---
    for (const peel of this.peels) {
      peel.life -= dt;
      if (peel.flying) {
        peel.x += peel.vx * dt;
        peel.y += peel.vy * dt;
        peel.spin += dt * 14;
        if (peel.life <= 0 || peel.x < 20 || peel.y < 20 || peel.x > ARENA - 20 || peel.y > ARENA - 20) {
          peel.flying = false; // a miss lies where it lands, waiting
          peel.life = 7;
        }
      }
      let victim = null;
      this.near(peel.x, peel.y, 34, (e) => {
        if (!victim && (e.state === "walk" || (e.type === "boss" && peel.flying)) && Math.hypot(e.x - peel.x, e.y - peel.y) < e.r + 11) victim = e;
      });
      if (!victim) continue;
      peel.life = -1;
      const chain = this.nextId++,
        power = s.slidePower * (peel.golden ? 1.6 : 1);
      // thrown peels knock monkeys away from you; a peel on the ground sends them the way they were heading
      const dx = peel.flying ? peel.vx : p.x - victim.x,
        dy = peel.flying ? peel.vy : p.y - victim.y;
      this.hurt(victim, s.damage * (peel.golden ? 3 : 1), chain);
      this.slip(victim, dx, dy, power, 0, chain);
      this.events.push({ type: "bonk", x: victim.x, y: victim.y, golden: peel.golden });
      if (peel.ripe) this.burst(peel.x, peel.y, 105, chain);
    }
    this.peels = this.peels.filter((q) => q.life > 0);

    // --- monkeys ---
    for (const e of this.enemies) {
      e.t += dt;
      e.flash = Math.max(0, (e.flash ?? 0) - dt);
      if (e.state === "ko") continue;
      if (e.state === "slide") {
        const speed = Math.hypot(e.sx, e.sy);
        e.x += e.sx * dt;
        e.y += e.sy * dt;
        const drag = Math.exp(-1.7 * dt);
        e.sx *= drag;
        e.sy *= drag;
        if (speed > 130) {
          this.near(e.x, e.y, e.r + 32, (o) => {
            if (o === e || o.state === "ko" || o.state === "slide" || o === e.hit) return;
            const dx = o.x - e.x,
              dy = o.y - e.y,
              d = Math.hypot(dx, dy);
            if (d > e.r + o.r) return;
            e.hit = o;
            const impact = s.damage * (0.6 + speed / 520) * Math.sqrt(e.mass);
            this.hurt(o, impact, e.chain);
            this.hurt(e, impact * 0.25, e.chain);
            if (o.state !== "ko" && e.depth < s.chainDepth)
              this.slip(o, e.sx * 0.7 + (dx / (d || 1)) * speed * 0.5, e.sy * 0.7 + (dy / (d || 1)) * speed * 0.5, speed * s.chainKeep * Math.sqrt(e.mass), e.depth + 1, e.chain);
            e.sx *= 0.82;
            e.sy *= 0.82;
            this.events.push({ type: "bump", x: o.x, y: o.y });
          });
          for (const t of this.trees) {
            const dx = e.x - t.x,
              dy = e.y - t.y,
              d = Math.hypot(dx, dy);
            if (d < t.r + e.r && d > 0.01) {
              const nx = dx / d,
                ny = dy / d,
                dot = e.sx * nx + e.sy * ny;
              e.x = t.x + nx * (t.r + e.r);
              e.y = t.y + ny * (t.r + e.r);
              if (dot < 0) {
                e.sx = (e.sx - 2 * dot * nx) * 0.45;
                e.sy = (e.sy - 2 * dot * ny) * 0.45;
                this.hurt(e, s.damage * 1.5, e.chain);
                if (t.shake <= 0) {
                  t.shake = 1.2;
                  for (let i = 0; i < s.coconuts; i++) {
                    const a = R() * 6.283,
                      rr = 30 + R() * 70;
                    this.coconuts.push({ x: t.x + Math.cos(a) * rr, y: t.y + Math.sin(a) * rr, t: 0.45 + i * 0.12, r: 62, friendly: true, chain: e.chain });
                  }
                  this.events.push({ type: "crash", x: t.x, y: t.y });
                }
              }
            }
          }
        }
        if (e.x < e.r || e.x > ARENA - e.r) {
          e.x = clamp(e.x, e.r, ARENA - e.r);
          e.sx *= -0.5;
          if (speed > 200) this.hurt(e, s.damage, e.chain);
        }
        if (e.y < e.r || e.y > ARENA - e.r) {
          e.y = clamp(e.y, e.r, ARENA - e.r);
          e.sy *= -0.5;
          if (speed > 200) this.hurt(e, s.damage, e.chain);
        }
        if (e.state === "slide" && Math.hypot(e.sx, e.sy) < 55) {
          e.state = "dizzy";
          e.t = 0;
        }
        continue;
      }
      if (e.state === "dizzy") {
        if (e.t > 0.9) e.state = "walk";
        continue;
      }
      // walking
      let dx = p.x - e.x,
        dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      let speed = e.speed;
      if (e.type === "thrower") {
        e.cool -= dt;
        if (d < 300) speed = d < 230 ? -e.speed * 0.6 : 0;
        if (e.cool <= 0 && d < 420) {
          e.cool = 2.9;
          this.coconuts.push({ x: p.x + p.vx * 0.35, y: p.y + p.vy * 0.35, t: 1, r: 44, friendly: false, dmg: e.dmg });
          this.events.push({ type: "lob", x: e.x, y: e.y });
        }
      } else if (e.type === "boss") {
        e.phaseT -= dt;
        if (e.phase === "stalk" && e.phaseT <= 0) {
          e.phase = "wind";
          e.phaseT = 0.85;
          e.cx = dx;
          e.cy = dy;
          this.events.push({ type: "bossWind", x: e.x, y: e.y });
        } else if (e.phase === "wind") {
          speed = 0;
          if (e.phaseT <= 0) {
            e.phase = "charge";
            e.phaseT = 0.75;
          }
        } else if (e.phase === "charge") {
          dx = e.cx;
          dy = e.cy;
          speed = 640;
          for (const t of this.trees)
            if (Math.hypot(e.x - t.x, e.y - t.y) < t.r + e.r) {
              e.phase = "stun"; // he ran into a palm: wide open
              e.phaseT = 2.2;
              this.hurt(e, 60);
              this.events.push({ type: "crash", x: t.x, y: t.y });
            }
          if (e.phase === "charge" && e.phaseT <= 0) {
            e.phase = "stalk";
            e.phaseT = 3.2;
          }
        } else if (e.phase === "stun") {
          speed = 0;
          if (e.phaseT <= 0) {
            e.phase = "stalk";
            e.phaseT = 2;
          }
        }
      }
      e.x += dx * speed * dt;
      e.y += dy * speed * dt;
      // keep a little personal space so the crowd reads as a crowd
      if (e.type !== "boss")
        this.near(e.x, e.y, e.r + 18, (o) => {
          if (o === e || o.id < e.id || o.state !== "walk") return;
          const ox = e.x - o.x,
            oy = e.y - o.y,
            od = Math.hypot(ox, oy),
            min = e.r + o.r;
          if (od < min && od > 0.01) {
            const push = ((min - od) / od) * 0.5,
              share = o.mass / (e.mass + o.mass);
            e.x += ox * push * share * 2;
            e.y += oy * push * share * 2;
            if (o.type !== "boss") {
              o.x -= ox * push * (1 - share) * 2;
              o.y -= oy * push * (1 - share) * 2;
            }
          }
        });
      if (e.type !== "boss" || e.phase !== "charge")
        for (const t of this.trees) {
          const tx = e.x - t.x,
            ty = e.y - t.y,
            td = Math.hypot(tx, ty);
          if (td < t.r + e.r && td > 0.01) {
            e.x = t.x + (tx / td) * (t.r + e.r);
            e.y = t.y + (ty / td) * (t.r + e.r);
          }
        }
      e.x = clamp(e.x, e.r, ARENA - e.r);
      e.y = clamp(e.y, e.r, ARENA - e.r);
      // touching the banana
      const pd = Math.hypot(p.x - e.x, p.y - e.y);
      if (pd < e.r + p.r) {
        if (p.dash > 0) {
          this.hurt(e, s.damage, p.dashChain);
          this.slip(e, e.x - p.x + p.dashX * 30, e.y - p.y + p.dashY * 30, s.slidePower * 1.1, 0, p.dashChain);
        } else if (p.hurt <= 0) this.wound(e.dmg, e.type);
      }
    }
    for (const e of this.enemies) if (e.state === "ko" && e.t > 0.7) e.gone = true;
    this.enemies = this.enemies.filter((e) => !e.gone);

    // --- coconuts ---
    for (const c of this.coconuts) {
      c.t -= dt;
      if (c.t > 0) continue;
      c.gone = true;
      this.events.push({ type: "thunk", x: c.x, y: c.y, friendly: c.friendly });
      if (c.friendly) {
        this.near(c.x, c.y, c.r + 30, (e) => {
          if (e.state !== "ko" && Math.hypot(e.x - c.x, e.y - c.y) < c.r + e.r) {
            this.hurt(e, s.damage * 2, c.chain);
            if (e.state === "walk") this.slip(e, e.x - c.x || 1, e.y - c.y, s.slidePower * 0.6, 2, c.chain);
          }
        });
      } else if (p.hurt <= 0 && p.dash <= 0 && Math.hypot(p.x - c.x, p.y - c.y) < c.r) this.wound(c.dmg, "coconut");
    }
    this.coconuts = this.coconuts.filter((c) => !c.gone);
    if (this.status !== "playing") return;

    // --- drops ---
    for (const o of this.orbs) {
      o.t += dt;
      const dx = p.x - o.x,
        dy = p.y - o.y,
        d = Math.hypot(dx, dy);
      if (d < s.magnet || o.pull) {
        o.pull = true;
        const v = Math.min(d, (380 + o.t * 300) * dt);
        o.x += (dx / (d || 1)) * v;
        o.y += (dy / (d || 1)) * v;
      }
      if (d < p.r + 8) {
        o.gone = true;
        this.events.push({ type: "pickup" });
        this.gainXp(o.v);
      }
    }
    this.orbs = this.orbs.filter((o) => !o.gone && o.t < 60);
    if (this.chains.size > 40) for (const k of [...this.chains.keys()].slice(0, 20)) this.chains.delete(k);

    // --- the troop keeps coming ---
    this.spawnIn -= dt;
    const t = this.time,
      alive = this.enemies.length;
    if (this.spawnIn <= 0 && alive < MAX_ENEMIES) {
      this.spawnIn = Math.max(0.16, 1.15 - t / 150);
      const pack = 1 + Math.floor(t / 28) + (R() < 0.25 ? 2 : 0),
        a = R() * 6.283,
        roll = R(),
        type = t > 95 && roll < 0.1 ? "gorilla" : t > 60 && roll < 0.24 ? "thrower" : t > 18 && roll < 0.5 ? "baby" : "monkey",
        n = type === "gorilla" ? 1 : type === "baby" ? pack + 2 : type === "thrower" ? Math.ceil(pack / 3) : pack;
      for (let i = 0; i < Math.min(n, 9); i++) {
        const dist = 560 + R() * 120,
          aa = a + (R() - 0.5) * 0.5;
        let x = p.x + Math.cos(aa) * dist,
          y = p.y + Math.sin(aa) * dist;
        // off the edge of the clearing? come in from the other side instead
        if (x < 20 || x > ARENA - 20) x = p.x - Math.cos(aa) * dist;
        if (y < 20 || y > ARENA - 20) y = p.y - Math.sin(aa) * dist;
        this.spawn(type, clamp(x, 20, ARENA - 20), clamp(y, 20, ARENA - 20));
      }
    }
    if (t >= this.bossAt) {
      this.bossAt += 120;
      const a = R() * 6.283;
      this.spawn("boss", clamp(p.x + Math.cos(a) * 600, 80, ARENA - 80), clamp(p.y + Math.sin(a) * 600, 80, ARENA - 80), hpScaleAt(t) * 0.8);
      this.events.push({ type: "boss" });
    }
  }
  wound(amount, by) {
    const p = this.player;
    p.hp -= amount;
    p.hurt = 0.7;
    this.events.push({ type: "hurt", by });
    if (p.hp <= 0) {
      p.hp = 0;
      this.status = "over";
      this.events.push({ type: "over", by });
    }
  }
}

/** A simple pilot for tests and the title screen: run from the crowd, dash when cornered. */
export function autopilot(game) {
  const p = game.player;
  let fx = 0,
    fy = 0,
    close = 0;
  for (const e of game.enemies) {
    if (e.state !== "walk") continue;
    const dx = p.x - e.x,
      dy = p.y - e.y,
      d = Math.hypot(dx, dy);
    if (d < 260) {
      const w = (260 - d) / 260 / (d || 1);
      fx += dx * w;
      fy += dy * w;
      if (d < 70) close++;
    }
  }
  for (const c of game.coconuts)
    if (!c.friendly) {
      const dx = p.x - c.x,
        dy = p.y - c.y,
        d = Math.hypot(dx, dy) || 1;
      if (d < c.r + 40) {
        fx += (dx / d) * 2;
        fy += (dy / d) * 2;
      }
    }
  // drift back toward the middle and circle, so the troop strings out behind
  const cx = ARENA / 2 - p.x,
    cy = ARENA / 2 - p.y,
    cd = Math.hypot(cx, cy) || 1;
  fx += (cx / cd) * (cd / 700) + (-cy / cd) * 0.35;
  fy += (cy / cd) * (cd / 700) + (cx / cd) * 0.35;
  for (const o of game.orbs) {
    const dx = o.x - p.x,
      dy = o.y - p.y,
      d = Math.hypot(dx, dy);
    if (d < 200 && d > 1) {
      fx += (dx / d) * 0.25;
      fy += (dy / d) * 0.25;
    }
  }
  const n = Math.hypot(fx, fy) || 1;
  return { x: fx / n, y: fy / n, dash: close >= 2 };
}
