// Cosmic Dodge — Claude Fable 5.2 edition.
// Deterministic simulation: same seed + same inputs = same run. The page
// advances it in fixed 1/120 s steps, so it plays the same on any display.
import { clamp, rng, hashString } from "../../../js/fable/kit.js?v=1";

export const VERSION = "claude_fable_5_2";
export const RULESET = 1;
export const H = 1000; // field height in units; width follows the screen
export const REF_W = 800; // "ten rocks per level" holds exactly at this width
export const MIN_W = 560;
export const MAX_W = 1600;
export const STEP = 1 / 120;
export const PLAYER_R = 9;
export const GRAZE = 36; // how far past a hazard's edge still counts as a graze
export const SHIP_SPEED = 860;
export const WARP_SCALE = 0.32; // world speed while warping
export const WARP_DRAIN = 22; // flow per second
export const WARP_MIN = 6; // flow needed to start a warp
export const FLOW_FLOOR = 24; // flow always recovers to this reserve
export const SECTOR_LEVELS = 5;

export const SECTORS = [
  { name: "Quiet Orbit", line: "Loose rock. Learn to pass close." },
  { name: "Glass Belt", line: "Ice shards cut in at an angle." },
  { name: "Ember Reach", line: "Comets announce themselves. Briefly." },
  { name: "Serpent Drift", line: "The debris has learned to weave." },
  { name: "Crosswind", line: "Not everything falls downward." },
  { name: "Terminal Light", line: "Everything, all at once." },
];

export const fieldWidth = (aspect) =>
  clamp(Math.round((Number.isFinite(aspect) ? aspect : 0.8) * H), MIN_W, MAX_W);
export const speedAt = (level) =>
  level <= 30 ? 290 + 25 * (level - 1) : 1015 + 8 * (level - 30);
export const rateAt = (level) => Math.min(7.6, 1.6 + 0.2 * (level - 1));
export const multiplierAt = (flow) =>
  flow >= 100 ? 8 : 1 + Math.floor(Math.max(0, flow - 16) / 12);
export const dailySeed = (day) => hashString(`cosmic-dodge-fable:${day}`);

/** Closest approach of a point moving from (ax,ay) to (bx,by) to the origin. */
export function sweptDistance(ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    len = dx * dx + dy * dy,
    t = len ? clamp(-(ax * dx + ay * dy) / len, 0, 1) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Distance from a point to a bar's centre line (a rotated segment). */
export function barDistance(px, py, bar, x = bar.x, y = bar.y, angle = bar.angle) {
  const cx = Math.cos(angle) * bar.half,
    cy = Math.sin(angle) * bar.half,
    ax = x - cx,
    ay = y - cy,
    dx = 2 * cx,
    dy = 2 * cy,
    t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

export class Run {
  constructor({ width = REF_W, seed = 1, mode = "endless", day = "" } = {}) {
    this.width = clamp(width, MIN_W, MAX_W);
    this.height = H;
    this.seed = seed >>> 0;
    this.mode = mode;
    this.day = day;
    this.random = rng(this.seed);
    this.status = "ready";
    this.time = 0; // real seconds played
    this.world = 0; // seconds as the debris experiences them
    this.points = 0;
    this.progress = 0;
    this.cleared = 0;
    this.flow = FLOW_FLOOR;
    this.flowIdle = 0;
    this.warp = 0; // eased 0..1
    this.warping = false;
    this.warpTime = 0;
    this.shield = 1;
    this.invulnerable = 0;
    this.grazes = 0;
    this.chain = 0;
    this.chainLeft = 0;
    this.bestMultiplier = 1;
    this.hazards = [];
    this.pickups = [];
    this.telegraphs = [];
    this.queue = [];
    this.events = [];
    this.nextId = 1;
    this.nextFormation = 1.1;
    this.lastFormation = "";
    this.dustIn = 2.5;
    this.aegisIn = 24;
    this.player = { x: this.width / 2, y: 790, vx: 0, vy: 0, r: PLAYER_R, lean: 0 };
  }
  get score() {
    return Math.floor(this.points);
  }
  get level() {
    return Math.floor(this.progress / 10 + 1e-9) + 1;
  }
  get levelProgress() {
    return ((this.progress + 1e-9) % 10) / 10;
  }
  get sector() {
    return Math.floor((this.level - 1) / SECTOR_LEVELS);
  }
  get sectorInfo() {
    const i = this.sector;
    return { ...SECTORS[i % SECTORS.length], index: i, lap: Math.floor(i / SECTORS.length) };
  }
  get multiplier() {
    return multiplierAt(this.flow);
  }
  /** One rock's worth of progress. Wider fields hold more rocks, each worth less. */
  get share() {
    return REF_W / this.width;
  }
  get bounds() {
    return { left: 34, right: this.width - 34, top: 150, bottom: H - 64 };
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
  drainEvents() {
    return this.events.splice(0);
  }

  update(dt, input = {}) {
    if (this.status !== "playing" || !(dt > 0)) return;
    dt = Math.min(dt, 0.05);
    const p = this.player;

    // --- flow and warp -------------------------------------------------
    const want =
      !!input.warp && (this.warping ? this.flow > 0 : this.flow >= WARP_MIN);
    if (want !== this.warping) {
      this.warping = want;
      this.events.push({ type: want ? "warpOn" : "warpOff" });
    }
    this.warp += ((this.warping ? 1 : 0) - this.warp) * (1 - Math.exp(-12 * dt));
    if (this.warping) {
      this.flow = Math.max(0, this.flow - WARP_DRAIN * dt);
      this.warpTime += dt;
      this.flowIdle = 0;
    } else {
      this.flowIdle += dt;
      if (this.flow < FLOW_FLOOR) this.flow = Math.min(FLOW_FLOOR, this.flow + 4 * dt);
      else if (this.flowIdle > 2.5) this.flow = Math.max(FLOW_FLOOR, this.flow - 3 * dt);
    }
    const wdt = dt * (1 - (1 - WARP_SCALE) * this.warp);
    this.time += dt;
    this.world += wdt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.chainLeft -= dt;
    if (this.chainLeft <= 0) this.chain = 0;

    // --- ship ----------------------------------------------------------
    const pdt = dt * (1 - 0.15 * this.warp),
      b = this.bounds,
      ox = p.x,
      oy = p.y;
    const ax = clamp(Number(input.x) || 0, -1, 1),
      ay = clamp(Number(input.y) || 0, -1, 1);
    if (ax || ay) {
      const n = Math.max(1, Math.hypot(ax, ay)),
        k = 1 - Math.exp(-22 * pdt);
      p.vx += ((ax / n) * SHIP_SPEED - p.vx) * k;
      p.vy += ((ay / n) * SHIP_SPEED - p.vy) * k;
    } else if (
      input.target &&
      Number.isFinite(input.target.x) &&
      Number.isFinite(input.target.y)
    ) {
      let vx = (input.target.x - p.x) * 16,
        vy = (input.target.y - p.y) * 16;
      const sp = Math.hypot(vx, vy),
        max = SHIP_SPEED * 1.7;
      if (sp > max) {
        vx *= max / sp;
        vy *= max / sp;
      }
      p.vx = vx;
      p.vy = vy;
    } else {
      const k = 1 - Math.exp(-16 * pdt);
      p.vx -= p.vx * k;
      p.vy -= p.vy * k;
    }
    p.x += p.vx * pdt;
    p.y += p.vy * pdt;
    if (p.x < b.left || p.x > b.right) {
      p.x = clamp(p.x, b.left, b.right);
      p.vx = 0;
    }
    if (p.y < b.top || p.y > b.bottom) {
      p.y = clamp(p.y, b.top, b.bottom);
      p.vy = 0;
    }
    p.lean += (clamp(p.vx / SHIP_SPEED, -1, 1) - p.lean) * (1 - Math.exp(-12 * dt));

    // --- director ------------------------------------------------------
    if (this.world >= this.nextFormation) this.direct();
    while (this.queue.length && this.queue[0].at <= this.world)
      this.spawn(this.queue.shift());
    for (const t of this.telegraphs) t.left -= wdt;
    this.telegraphs = this.telegraphs.filter((t) => t.left > 0);

    // --- hazards -------------------------------------------------------
    const born = [];
    for (const h of this.hazards) {
      const hx = h.x,
        hy = h.y,
        ha = h.angle;
      h.age += wdt;
      h.y += h.vy * wdt;
      if (h.kind === "drifter")
        h.x = h.x0 + h.amp * Math.sin(h.omega * h.age + h.phase);
      else h.x += h.vx * wdt;
      h.angle += h.spin * wdt;
      if (h.kind === "splitter" && h.y >= h.splitY) {
        h.dead = true;
        this.events.push({ type: "split", x: h.x, y: h.y, r: h.r });
        for (const side of [-1, 0, 1])
          born.push({
            kind: "rock",
            x: h.x + side * h.r * 0.5,
            y: h.y,
            r: h.r * 0.46,
            vx: side * (150 + h.vy * 0.22),
            vy: h.vy * (side ? 1.02 : 1.16),
          });
        continue;
      }
      let d, reach;
      if (h.kind === "bar") {
        d = Math.min(
          barDistance(p.x, p.y, h),
          barDistance((p.x + ox) / 2, (p.y + oy) / 2, h, (h.x + hx) / 2, (h.y + hy) / 2, (h.angle + ha) / 2),
        );
        reach = h.r * 0.86 + p.r;
      } else {
        d = sweptDistance(hx - ox, hy - oy, h.x - p.x, h.y - p.y);
        reach = h.r * 0.8 + p.r;
      }
      if (!h.hit && d < reach) {
        h.hit = true;
        if (this.invulnerable <= 0) this.takeHit(h);
        if (this.status !== "playing") return;
      } else if (!h.hit && !h.grazed && d < reach + GRAZE && this.invulnerable <= 0) {
        this.graze(h, 1 - (d - reach) / GRAZE);
      }
      const extent =
        h.kind === "bar"
          ? (h.spin ? h.half : Math.abs(Math.sin(h.angle)) * h.half) + h.r
          : h.r;
      if (
        h.y - extent > H + 10 ||
        (h.vx < 0 && h.x < -extent - 150) ||
        (h.vx > 0 && h.x > this.width + extent + 150)
      ) {
        h.dead = true;
        this.clear(h);
      }
    }
    if (born.length) for (const spec of born) this.spawn(spec);
    this.hazards = this.hazards.filter((h) => !h.dead);

    // --- pickups -------------------------------------------------------
    this.dustIn -= wdt;
    if (this.dustIn <= 0) {
      this.dustIn += 2.6 + this.random() * 1.6;
      const x = 60 + this.random() * (this.width - 120),
        vy = speedAt(this.level) * 0.62,
        lean = (this.random() - 0.5) * 70;
      for (let i = 0; i < 3; i++)
        this.pickups.push({ type: "dust", x: clamp(x + lean * i, 40, this.width - 40), y: -20 - i * 64, vy, r: 10, age: 0 });
    }
    if (!this.shield) {
      this.aegisIn -= wdt;
      if (this.aegisIn <= 0) {
        this.aegisIn = 24;
        this.dropAegis();
      }
    }
    for (const u of this.pickups) {
      u.age += wdt;
      u.y += u.vy * wdt;
      const dx = p.x - u.x,
        dy = p.y - u.y,
        d = Math.hypot(dx, dy);
      if (d < (this.warping ? 190 : 110) && d > 0.01) {
        const pull = Math.min(1, dt * 9);
        u.x += dx * pull;
        u.y += dy * pull;
      }
      if (d < u.r + p.r + 16) {
        u.dead = true;
        if (u.type === "aegis") {
          this.shield = 1;
          this.events.push({ type: "aegis", x: u.x, y: u.y });
        } else {
          const before = this.multiplier;
          this.flow = Math.min(100, this.flow + 4);
          this.flowIdle = 0;
          const pts = 20 * this.multiplier;
          this.points += pts;
          this.events.push({ type: "dust", x: u.x, y: u.y, pts });
          this.noteMultiplier(before);
        }
      } else if (u.y > H + 40) u.dead = true;
    }
    this.pickups = this.pickups.filter((u) => !u.dead);
  }

  noteMultiplier(before) {
    const now = this.multiplier;
    if (now > before) {
      this.bestMultiplier = Math.max(this.bestMultiplier, now);
      this.events.push({ type: "multiplier", value: now });
    }
  }
  graze(h, closeness) {
    h.grazed = true;
    this.grazes++;
    this.chain++;
    this.chainLeft = 1.6;
    const before = this.multiplier;
    this.flow = Math.min(100, this.flow + (5 + 5 * closeness) * (this.warping ? 0.45 : 1));
    this.flowIdle = 0;
    const pts = 5 * this.multiplier;
    this.points += pts;
    const p = this.player;
    let gx = h.x,
      gy = h.y;
    if (h.kind === "bar") {
      // spark where the hull passes the bar, not at the bar's far centre
      const c = Math.cos(h.angle),
        s = Math.sin(h.angle),
        t = clamp((p.x - h.x) * c + (p.y - h.y) * s, -h.half, h.half);
      gx = h.x + c * t;
      gy = h.y + s * t;
    }
    this.events.push({
      type: "graze",
      x: (p.x + gx) / 2,
      y: (p.y + gy) / 2,
      pts,
      chain: this.chain,
      closeness,
    });
    this.noteMultiplier(before);
  }
  clear(h, scored = true) {
    const level = this.level;
    this.cleared++;
    this.progress += this.share;
    if (scored) this.points += 10 * this.multiplier * this.share;
    if (this.level !== level) {
      this.events.push({ type: "level", level: this.level });
      if ((this.level - 1) % SECTOR_LEVELS === 0) {
        const bonus = 200 * this.sector;
        this.points += bonus;
        this.nextFormation = Math.max(this.nextFormation, this.world + 2.4);
        if (!this.shield) this.dropAegis();
        this.events.push({ type: "sector", sector: this.sector, bonus, ...this.sectorInfo });
      }
    }
    void h;
  }
  takeHit(h) {
    const p = this.player;
    if (this.shield > 0) {
      this.shield = 0;
      this.invulnerable = 1.6;
      this.aegisIn = 24;
      let swept = 0;
      for (const o of this.hazards) {
        if (o.dead) continue;
        const d = o.kind === "bar" ? barDistance(p.x, p.y, o) : Math.hypot(o.x - p.x, o.y - p.y);
        if (d < 270 + o.r) {
          o.dead = true;
          o.hit = true;
          swept++;
          this.clear(o, false);
          this.events.push({ type: "shatter", x: o.x, y: o.y, r: o.r, kind: o.kind, half: o.half, angle: o.angle });
        }
      }
      this.events.push({ type: "shield", x: p.x, y: p.y, swept });
    } else {
      this.status = "over";
      this.events.push({ type: "over", x: p.x, y: p.y, by: h.kind });
    }
  }
  dropAegis() {
    this.pickups.push({
      type: "aegis",
      x: 80 + this.random() * (this.width - 160),
      y: -30,
      vy: 210,
      r: 15,
      age: 0,
    });
  }

  spawn(spec) {
    if (spec.telegraph) {
      this.telegraphs.push({ ...spec.telegraph });
      this.events.push({ type: "telegraph", kind: spec.telegraph.kind });
      return null;
    }
    const r = spec.r ?? 26;
    const h = {
      id: this.nextId++,
      kind: spec.kind ?? "rock",
      x: spec.x,
      y: spec.y ?? -(spec.kind === "bar" ? Math.abs(Math.sin(spec.angle ?? 0)) * spec.half + r : r) - 12,
      vx: spec.vx ?? 0,
      vy: spec.vy ?? speedAt(this.level),
      r,
      angle: spec.angle ?? this.random() * 6.283,
      spin: spec.spin ?? (spec.kind === "bar" ? 0 : (this.random() - 0.5) * 2.4),
      half: spec.half ?? 0,
      age: 0,
      variant: Math.floor(this.random() * 1000),
      grazed: false,
      hit: false,
      dead: false,
    };
    if (h.kind === "drifter") {
      h.x0 = spec.x;
      h.amp = spec.amp;
      h.omega = spec.omega;
      h.phase = spec.phase ?? 0;
      h.x = h.x0 + h.amp * Math.sin(h.phase);
    }
    if (h.kind === "splitter") h.splitY = spec.splitY;
    this.hazards.push(h);
    return h;
  }
  enqueue(spec) {
    // The queue stays ordered by time; equal times keep insertion order.
    let i = this.queue.length;
    while (i > 0 && this.queue[i - 1].at > spec.at) i--;
    this.queue.splice(i, 0, spec);
  }

  /** Chooses and schedules the next formation. */
  direct() {
    const L = this.level,
      s = this.sector,
      debut = (unlock) => (s === unlock ? 2.2 : 1);
    const menu = [
      ["rain", 5],
      ["wall", L >= 2 ? 3 : 0],
      ["chevron", L >= 3 ? 2.5 : 0],
      ["corridor", L >= 4 ? 2 : 0],
      ["spinner", s >= 1 ? 2.5 : 0],
      ["stream", s >= 1 ? 3.5 * debut(1) : 0],
      ["comets", s >= 2 ? 3 * debut(2) : 0],
      ["splitters", s >= 2 ? 2.5 * debut(2) : 0],
      ["ribbon", s >= 3 ? 3 * debut(3) : 0],
      ["pincer", s >= 3 ? 2 : 0],
      ["crossfire", s >= 4 ? 3 * debut(4) : 0],
    ].filter(([name, w]) => w > 0 && (name === "rain" || name !== this.lastFormation));
    let roll = this.random() * menu.reduce((sum, [, w]) => sum + w, 0),
      pick = menu[0][0];
    for (const [name, w] of menu) {
      roll -= w;
      if (roll <= 0) {
        pick = name;
        break;
      }
    }
    this.lastFormation = pick;
    const { count, duration } = this[pick](L, speedAt(L));
    const rest = Math.max(0.3, (count * this.share) / rateAt(L) - duration);
    this.nextFormation = this.world + duration + rest;
    this.events.push({ type: "formation", name: pick });
  }

  // --- formations: each returns how many hazards it adds and how long it lasts

  rain(L, v) {
    const R = this.random,
      wf = this.width / REF_W,
      n = Math.max(3, Math.round((4 + Math.floor(R() * 4)) * wf)),
      duration = n * clamp(0.36 - L * 0.008, 0.14, 0.36) * this.share;
    const aimed = R() < 0.6 ? Math.floor(R() * n) : -1,
      big = clamp(34 + L, 34, 52);
    for (let i = 0; i < n; i++)
      this.enqueue({
        at: this.world + (i / n) * duration + R() * 0.08,
        kind: "rock",
        x: i === aimed ? clamp(this.player.x + (R() - 0.5) * 60, 30, this.width - 30) : 30 + R() * (this.width - 60),
        r: 18 + R() * R() * big,
        vx: (R() - 0.5) * 50,
        vy: v * (0.86 + R() * 0.3),
      });
    return { count: n, duration };
  }
  gapCentres(width = clamp(262 - this.level * 4, 150, 262)) {
    const n = Math.max(1, Math.round(this.width / 760)),
      seg = this.width / n;
    return {
      gap: width,
      centres: Array.from({ length: n }, (_, i) =>
        clamp(seg * i + seg * (0.18 + this.random() * 0.64), width / 2 + 24, this.width - width / 2 - 24),
      ),
    };
  }
  /** One row of bars with openings at `centres`. Returns the bar count. */
  row(at, centres, gap, vy, y) {
    const edges = [-60];
    for (const c of [...centres].sort((a, b) => a - b)) edges.push(c - gap / 2, c + gap / 2);
    edges.push(this.width + 60);
    let count = 0;
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i],
        b = edges[i + 1];
      if (b - a < 46) continue;
      this.enqueue({ at, kind: "bar", x: (a + b) / 2, y, half: (b - a) / 2 - 15, r: 15, angle: 0, spin: 0, vy });
      count++;
    }
    return count;
  }
  wall(L, v) {
    const { gap, centres } = this.gapCentres();
    return { count: this.row(this.world, centres, gap, v * 0.86), duration: 0.2 };
  }
  corridor(L, v) {
    const rows = 3 + Math.floor(this.random() * 2),
      every = clamp(560 / v, 0.4, 0.95),
      reach = Math.min(300, SHIP_SPEED * every * 0.36);
    let { gap, centres } = this.gapCentres(clamp(280 - L * 4, 170, 280)),
      count = 0;
    for (let i = 0; i < rows; i++) {
      count += this.row(this.world + i * every, centres, gap, v * 0.86);
      centres = centres.map((c) =>
        clamp(c + (this.random() * 2 - 1) * reach, gap / 2 + 24, this.width - gap / 2 - 24),
      );
    }
    return { count, duration: rows * every };
  }
  chevron(L, v) {
    const R = this.random,
      n = Math.max(1, Math.round(this.width / 900)),
      seg = this.width / n,
      gap = clamp(250 - L * 3, 160, 250),
      tilt = 0.42 + R() * 0.2,
      down = R() < 0.6 ? 1 : -1;
    let count = 0;
    for (let i = 0; i < n; i++) {
      const cx = seg * (i + 0.3 + R() * 0.4),
        half = Math.min(210, seg / 2 - gap / 2 - 30);
      if (half < 60) continue;
      for (const side of [-1, 1]) {
        const off = gap / 2 + Math.cos(tilt) * half;
        this.enqueue({
          at: this.world,
          kind: "bar",
          x: cx + side * off,
          y: -Math.sin(tilt) * half - 40,
          half,
          r: 15,
          angle: side * down * tilt,
          spin: 0,
          vy: v * 0.82,
        });
        count++;
      }
    }
    if (!count) return this.wall(L, v);
    return { count, duration: 0.5 };
  }
  spinner(L, v) {
    const R = this.random,
      n = Math.max(1, Math.round(this.width / 620)),
      seg = this.width / n;
    for (let i = 0; i < n; i++)
      this.enqueue({
        at: this.world + i * 0.25,
        kind: "bar",
        x: seg * (i + 0.25 + R() * 0.5),
        half: 110 + R() * 60,
        r: 14,
        angle: R() * 3.14,
        spin: (R() < 0.5 ? -1 : 1) * (1.3 + R() * 0.9 + L * 0.02),
        vy: v * 0.66,
      });
    return { count: n, duration: n * 0.25 + 0.4 };
  }
  stream(L, v, dir = this.random() < 0.5 ? -1 : 1, from = null) {
    const R = this.random,
      n = Math.max(5, Math.round((6 + Math.floor(R() * 4)) * Math.sqrt(this.width / REF_W))),
      every = clamp(0.15 - L * 0.002, 0.08, 0.15),
      start = from ?? (dir > 0 ? R() * this.width * 0.3 : this.width * (0.7 + R() * 0.3)),
      step = (this.width * 0.55) / n;
    for (let i = 0; i < n; i++)
      this.enqueue({
        at: this.world + i * every,
        kind: "shard",
        x: start + dir * step * i,
        r: 11,
        vx: dir * v * 0.42,
        vy: v * 1.22,
      });
    return { count: n, duration: n * every };
  }
  pincer(L, v) {
    const a = this.stream(L, v, 1, this.width * 0.06),
      b = this.stream(L, v, -1, this.width * 0.94);
    return { count: a.count + b.count, duration: Math.max(a.duration, b.duration) };
  }
  comets(L, v) {
    const R = this.random,
      n = Math.max(1, Math.round((1 + Math.floor(R() * 3)) * (this.width / REF_W))),
      warn = clamp(1.05 - L * 0.008, 0.7, 1.05),
      lanes = [clamp(this.player.x, 40, this.width - 40)];
    for (let i = 1, tries = 0; i < n && tries < 40; tries++) {
      const x = 40 + R() * (this.width - 80);
      if (lanes.every((l) => Math.abs(l - x) > 150)) {
        lanes.push(x);
        i++;
      }
    }
    lanes.forEach((x, i) => {
      const at = this.world + i * 0.16;
      this.enqueue({ at, telegraph: { kind: "lane", x, left: warn, total: warn } });
      this.enqueue({ at: at + warn, kind: "comet", x, r: 17, vx: 0, vy: v * 2.1 + 320, spin: 0 });
    });
    return { count: lanes.length, duration: warn + lanes.length * 0.16 };
  }
  splitters(L, v) {
    const R = this.random,
      n = Math.max(1, Math.round((1 + Math.floor(R() * 2)) * (this.width / REF_W))),
      seg = this.width / n;
    for (let i = 0; i < n; i++)
      this.enqueue({
        at: this.world + i * 0.3,
        kind: "splitter",
        x: seg * (i + 0.2 + R() * 0.6),
        r: 42 + R() * 8,
        vy: v * 0.74,
        splitY: H * (0.26 + R() * 0.2),
      });
    return { count: n * 3, duration: n * 0.3 + 0.6 };
  }
  ribbon(L, v) {
    const R = this.random,
      n = 7 + Math.floor(R() * 4),
      strands = Math.max(1, Math.round(this.width / 900)),
      seg = this.width / strands,
      every = clamp(88 / (v * 0.8), 0.07, 0.2);
    for (let s = 0; s < strands; s++) {
      const amp = Math.min(200, seg / 2 - 70),
        x0 = seg * s + amp + 50 + R() * Math.max(0, seg - 2 * amp - 100),
        omega = (R() < 0.5 ? -1 : 1) * (1.9 + R() * 0.8),
        phase = R() * 6.283;
      for (let i = 0; i < n; i++)
        this.enqueue({
          at: this.world + i * every,
          kind: "drifter",
          x: x0,
          amp,
          omega,
          phase,
          r: 17,
          vy: v * 0.8,
        });
    }
    return { count: n * strands, duration: n * every };
  }
  crossfire(L, v) {
    const R = this.random,
      n = Math.max(2, Math.round(3 * Math.sqrt(this.width / REF_W))),
      b = this.bounds,
      warn = 0.95,
      speed = Math.max(540, v * 1.1);
    for (let i = 0; i < n; i++) {
      const side = (i + (R() < 0.5 ? 0 : 1)) % 2 ? 1 : -1,
        y = i === 0 ? clamp(this.player.y, b.top + 30, b.bottom - 30) : b.top + 40 + R() * (b.bottom - b.top - 80),
        at = this.world + i * 0.34;
      this.enqueue({ at, telegraph: { kind: "side", side, y, left: warn, total: warn } });
      this.enqueue({
        at: at + warn,
        kind: "rock",
        x: side > 0 ? -70 : this.width + 70,
        y,
        r: 24,
        vx: side * speed,
        vy: v * 0.06,
      });
    }
    return { count: n, duration: warn + n * 0.34 };
  }
}

/**
 * A capable, slightly show-off pilot. Drives the demo behind the menu and
 * lets the tests fly thousands of runs. Reads the run; never changes it.
 */
export function autopilot(run, skill = 1) {
  const p = run.player,
    b = run.bounds,
    slow = 1 - (1 - WARP_SCALE) * run.warp,
    horizon = [0.08, 0.17, 0.27, 0.38, 0.5, 0.64],
    reach = SHIP_SPEED * 0.85;
  const danger = (x, y, t) => {
    let cost = 0;
    const wt = t * slow;
    for (const h of run.hazards) {
      if (h.hit) continue;
      const hy = h.y + h.vy * wt;
      let d, edge;
      if (h.kind === "bar") {
        d = barDistance(x, y, h, h.x + h.vx * wt, hy, h.angle + h.spin * wt);
        edge = h.r + PLAYER_R;
      } else {
        const hx = h.kind === "drifter" ? h.x0 + h.amp * Math.sin(h.omega * (h.age + wt) + h.phase) : h.x + h.vx * wt;
        d = Math.hypot(hx - x, hy - y);
        edge = h.r * 0.8 + PLAYER_R;
        if (h.kind === "splitter" && hy > h.splitY - 60) edge += 120;
      }
      const margin = d - edge;
      if (margin < 24) cost += 1000 / (0.25 + t);
      else if (margin < 46) cost += (h.grazed ? 6 : -9 * skill) / (0.4 + t);
      else if (margin < 110) cost += 3 / (0.4 + t);
    }
    if (t > 0.3 && t < 0.4)
      for (const h of run.hazards) {
        // look further ahead for anything long: find the opening early
        if (h.kind !== "bar" || h.hit) continue;
        const eta = (y - h.y) / (h.vy * slow);
        if (eta > 0 && eta < 1.7 && Math.abs(x - h.x) < Math.abs(Math.cos(h.angle)) * h.half + 34)
          cost += 150 / (0.25 + eta);
      }
    for (const g of run.telegraphs) {
      if (g.left > 0.55 + t) continue;
      const off = g.kind === "lane" ? Math.abs(g.x - x) : Math.abs(g.y - y);
      if (off < 60) cost += 400 / (0.3 + t);
    }
    return cost;
  };
  let best = null;
  for (let i = 0; i < 9; i++) {
    const dx = i === 0 ? 0 : Math.cos(((i - 1) / 8) * 6.2832),
      dy = i === 0 ? 0 : Math.sin(((i - 1) / 8) * 6.2832);
    let cost = 0;
    for (const t of horizon) {
      const x = clamp(p.x + dx * reach * t, b.left, b.right),
        y = clamp(p.y + dy * reach * t, b.top, b.bottom);
      cost += danger(x, y, t);
    }
    const ex = clamp(p.x + dx * reach * 0.4, b.left, b.right),
      ey = clamp(p.y + dy * reach * 0.4, b.top, b.bottom);
    cost += Math.abs(ex - run.width / 2) * 0.012 + Math.abs(ey - 800) * 0.03;
    if (ex <= b.left + 40 || ex >= b.right - 40) cost += 14;
    for (const u of run.pickups) {
      const d = Math.hypot(u.x - ex, u.y + u.vy * 0.4 - ey);
      if (d < 420) cost -= (u.type === "aegis" ? 30 : 10) * (1 - d / 420);
    }
    if (i === 0) cost -= 1.5;
    if (!best || cost < best.cost) best = { cost, x: dx, y: dy };
  }
  const trapped = best.cost > 700;
  return { x: best.x, y: best.y, warp: trapped ? run.flow >= WARP_MIN : run.warping && best.cost > 250 };
}
