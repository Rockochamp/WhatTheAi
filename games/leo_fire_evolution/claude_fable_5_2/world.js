// Leo's Fire Evolution — Claude Fable 5.2 edition. The rules, without drawing.
// Ten dark places. A lion cub with a small flame walks through each one,
// gathers fireflies, lights every lantern and leaves through a gate. His
// fire has changed by the time he arrives at the next. Nothing can hurt him.
import { rng, clamp } from "../../../js/fable/kit.js?v=1";

export const VERSION = "claude_fable_5_2";
export const RULESET = 1;
export const STEP = 1 / 60;
export const LEO_R = 22;
export const TOUCH = 48; // walking this close lights a lantern
export const POINTS = { firefly: 10, lantern: 100, perFirefly: 20, sleeper: 250, gate: 300 };

// One form per place. Each keeps everything the last one could do and adds one thing.
const form = (id, en, de, giftEn, giftDe, change, look) => ({ id, name: { en, de }, gift: { en: giftEn, de: giftDe }, change, look });
const FORM_LIST = [
  form("spark", "First Spark", "Erster Funke", "A small flame, and a roar that lights what is near.", "Eine kleine Flamme und ein Brüllen, das alles in der Nähe anzündet.", {}, { colors: ["#fff3b0", "#ffb03a", "#ff6a1f"], tongues: 5, height: 1 }),
  form("spiral", "Flame Spiral", "Flammenspirale", "Fireflies come to him from much farther away.", "Glühwürmchen kommen von viel weiter her zu ihm.", { pull: 150 }, { colors: ["#fff6c4", "#ffc94a", "#ff8a1f"], tongues: 6, height: 1.1, orbit: 3 }),
  form("volcano", "Volcano Fire", "Vulkanfeuer", "His roar reaches half again as far.", "Sein Brüllen reicht anderthalbmal so weit.", { roar: 340 }, { colors: ["#ffe08a", "#ff5a2a", "#a3121a"], tongues: 7, height: 1.25, embers: true }),
  form("inferno", "Leo Inferno", "Leo Inferno", "He runs a good deal faster.", "Er rennt ein gutes Stück schneller.", { speed: 300 }, { colors: ["#fff1a8", "#ff9b1f", "#ff3d1f"], tongues: 9, height: 1.5 }),
  form("phoenix", "Phoenix Fire", "Phönixfeuer", "He glides over water on wings of flame.", "Er gleitet auf Flammenflügeln über das Wasser.", { swim: true }, { colors: ["#fff0d0", "#ff8fa0", "#ff5a4a"], tongues: 7, height: 1.3, wings: true }),
  form("dragon", "Dragon Flame", "Drachenflamme", "He can roar again much sooner.", "Er kann viel früher wieder brüllen.", { cooldown: 2.5 }, { colors: ["#eafff0", "#7df0b0", "#1fa37a"], tongues: 8, height: 1.4, horns: true }),
  form("solar", "Solar Fire", "Sonnenfeuer", "His light reaches twice as far into the dark.", "Sein Licht reicht doppelt so weit ins Dunkel.", { light: 300 }, { colors: ["#ffffff", "#ffe45c", "#ffb01f"], tongues: 12, height: 1.2, rays: true }),
  form("star", "Starfire", "Sternenfeuer", "Lanterns light from farther off, without a roar.", "Laternen gehen schon von weitem an, ganz ohne Brüllen.", { touch: 130 }, { colors: ["#ffffff", "#9fe8ff", "#3d9bff"], tongues: 8, height: 1.3, stars: true }),
  form("galaxy", "Galaxy Flame", "Galaxieflamme", "The wind can no longer blow his fireflies away.", "Der Wind kann seine Glühwürmchen nicht mehr wegpusten.", { guard: true }, { colors: ["#ffe9ff", "#cb9dff", "#6a4dff"], tongues: 8, height: 1.4, orbit: 6 }),
  form("eternal", "Eternal Flame", "Ewige Flamme", "Everything at once, and a roar that crosses half the night.", "Alles auf einmal, und ein Brüllen, das durch die halbe Nacht geht.", { roar: 520, speed: 320 }, { colors: ["#ffffff", "#ffe9a8", "#ff9b3d"], tongues: 12, height: 1.6, rays: true, orbit: 4, wings: true }),
];
const BASE = { speed: 235, light: 170, pull: 78, roar: 230, cooldown: 5, touch: TOUCH, swim: false, guard: false };
export const FORMS = FORM_LIST.map((f, i) => ({ ...f, index: i, ...FORM_LIST.slice(0, i + 1).reduce((all, g) => ({ ...all, ...g.change }), BASE) }));

const place = (id, en, de, look, plan) => ({ id, name: { en, de }, ...look, ...plan });
export const PLACES = [
  place("meadow", "The Sleeping Meadow", "Die schlafende Wiese", { ground: "#3f7d4f", shade: "#2f6340", water: "#3f8fb5", night: "#0d1730", fire: "#ffb03a", things: ["tree", "tree", "bush", "flower"] }, { w: 1500, h: 1050, lanterns: 4, fireflies: 10, ponds: 1, rocks: 3, gusts: 0, scale: [57, 60, 62, 64, 67, 69] }),
  place("hill", "Whirlwind Hill", "Der Wirbelwindhügel", { ground: "#5c8a5a", shade: "#467148", water: "#4f9bb0", night: "#12203a", fire: "#ffc94a", things: ["bush", "flower", "reed", "tree"] }, { w: 1800, h: 1200, lanterns: 5, fireflies: 16, ponds: 1, rocks: 4, gusts: 2, scale: [59, 62, 64, 66, 69, 71] }),
  place("crater", "Black Sand Crater", "Der Schwarzsandkrater", { ground: "#5a4046", shade: "#46313a", water: "#c2452a", night: "#160c16", fire: "#ff5a2a", things: ["rock", "spire", "rock", "ember"] }, { w: 1900, h: 1300, lanterns: 6, fireflies: 14, ponds: 3, rocks: 8, gusts: 1, scale: [50, 53, 55, 57, 60, 62] }),
  place("savannah", "The Long Savannah", "Die weite Savanne", { ground: "#8a7a45", shade: "#72653a", water: "#4f8fa0", night: "#1a1430", fire: "#ff9b1f", things: ["reed", "acacia", "reed", "bush"] }, { w: 2700, h: 1250, lanterns: 6, fireflies: 18, ponds: 1, rocks: 4, gusts: 2, scale: [55, 57, 60, 62, 64, 67] }),
  place("lakes", "Feather Lakes", "Die Federseen", { ground: "#4f7f73", shade: "#3d665f", water: "#3f86c2", night: "#0e1a36", fire: "#ff8fa0", things: ["reed", "flower", "tree", "reed"] }, { w: 2100, h: 1450, lanterns: 6, fireflies: 18, ponds: 9, rocks: 3, gusts: 2, scale: [60, 62, 65, 67, 69, 72] }),
  place("ridge", "Dragon's Backbone", "Der Drachenrücken", { ground: "#4d6b5c", shade: "#3b5449", water: "#3f8f8a", night: "#0c1a1c", fire: "#7df0b0", things: ["spire", "rock", "bush", "spire"] }, { w: 2200, h: 1500, lanterns: 8, fireflies: 18, ponds: 2, rocks: 12, gusts: 3, scale: [52, 55, 57, 59, 62, 64] }),
  place("dunes", "The Sundial Desert", "Die Sonnenuhrwüste", { ground: "#a8875a", shade: "#8f724a", water: "#3fa0a8", night: "#1c1630", fire: "#ffe45c", things: ["pillar", "reed", "rock", "pillar"] }, { w: 2600, h: 1700, lanterns: 7, fireflies: 20, ponds: 1, rocks: 6, gusts: 3, scale: [57, 59, 62, 64, 66, 69] }),
  place("starfield", "Fallen Star Field", "Das Sternschnuppenfeld", { ground: "#3f4f7a", shade: "#323f66", water: "#5a7fd0", night: "#080c22", fire: "#9fe8ff", things: ["crystal", "bush", "crystal", "flower"] }, { w: 2400, h: 1600, lanterns: 9, fireflies: 22, ponds: 3, rocks: 6, gusts: 3, scale: [62, 64, 67, 69, 71, 74] }),
  place("deep", "The Windy Deep", "Die windige Tiefe", { ground: "#4a3f6e", shade: "#3a315a", water: "#6a5ad0", night: "#0c0820", fire: "#cb9dff", things: ["crystal", "spire", "reed", "crystal"] }, { w: 2400, h: 1600, lanterns: 8, fireflies: 24, ponds: 4, rocks: 6, gusts: 8, scale: [54, 57, 59, 61, 64, 66] }),
  place("heart", "The Heart of Night", "Das Herz der Nacht", { ground: "#5a3f4f", shade: "#47313f", water: "#b54f7a", night: "#12060f", fire: "#ffe9a8", things: ["pillar", "crystal", "tree", "flower"] }, { w: 2800, h: 1800, lanterns: 10, fireflies: 26, ponds: 5, rocks: 8, gusts: 5, scale: [57, 60, 62, 64, 67, 69] }),
];
export const SLEEPERS = ["owl", "fox", "hedgehog", "turtle", "rabbit"];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Lays out one place from its number alone, so it is the same for everyone. */
export function buildWorld(index) {
  const spec = PLACES[index] ?? PLACES[0],
    i = PLACES.indexOf(spec),
    swim = FORMS[i].swim,
    R = rng(1000 + i * 77),
    solids = [], // rocks, and water when it cannot be crossed
    ponds = [],
    rocks = [],
    taken = [];
  const spot = (margin = 90) => ({ x: margin + R() * (spec.w - margin * 2), y: margin + R() * (spec.h - margin * 2) });
  const free = (p, gap, onWater) =>
    rocks.every((o) => dist(p, o) > o.r + gap) && (onWater || ponds.every((o) => dist(p, o) > o.r + gap)) && taken.every((o) => dist(p, o) > o.gap + gap * 0.5);
  const start = { x: 130, y: spec.h / 2 },
    gate = { x: spec.w - 130, y: spec.h * (0.25 + R() * 0.5) };
  taken.push({ ...start, gap: 150 }, { ...gate, gap: 150 });
  const circles = (count, lo, hi, list) => {
    for (let n = 0, tries = 0; n < count && tries < 400; tries++) {
      const c = { ...spot(120), r: lo + R() * (hi - lo) };
      // leave a path at least a few cubs wide between any two obstacles
      if (dist(c, start) < c.r + 170 || dist(c, gate) < c.r + 170) continue;
      if ([...ponds, ...rocks].some((o) => dist(c, o) < c.r + o.r + LEO_R * 5)) continue;
      list.push(c);
      n++;
    }
  };
  circles(spec.ponds, 90, 190, ponds);
  circles(spec.rocks, 38, 80, rocks);
  solids.push(...rocks, ...(swim ? [] : ponds));
  const scatter = (count, gap, extra) => {
    const out = [];
    for (let n = 0, tries = 0; n < count && tries < 3000; tries++) {
      const p = spot();
      if (!free(p, tries < 2000 ? gap : gap * 0.5, swim)) continue;
      taken.push({ ...p, gap });
      out.push({ ...p, id: out.length, ...extra?.(out.length) });
      n++;
    }
    return out;
  };
  const lanterns = scatter(spec.lanterns, 230, (n) => ({ note: spec.scale[n % spec.scale.length] + (n >= spec.scale.length ? 12 : 0), beat: (n * 5 + (n % 2) * 2) % 16 }));
  const sleepers = scatter(2, 200, (n) => ({ kind: SLEEPERS[(i + n * 2) % SLEEPERS.length] }));
  // fireflies come in little groups
  const fireflies = [];
  for (let tries = 0; fireflies.length < spec.fireflies && tries < 2000; tries++) {
    const c = spot(110);
    if (!free(c, 60, swim)) continue;
    for (let k = 0, size = 2 + Math.floor(R() * 3); k < size && fireflies.length < spec.fireflies; k++) {
      const p = { x: clamp(c.x + (R() - 0.5) * 120, 50, spec.w - 50), y: clamp(c.y + (R() - 0.5) * 120, 50, spec.h - 50) };
      if (rocks.some((o) => dist(p, o) < o.r + 30) || (!swim && ponds.some((o) => dist(p, o) < o.r + 30))) continue;
      fireflies.push({ ...p, id: fireflies.length, phase: R() * 6.28 });
    }
  }
  const gusts = [];
  for (let n = 0; n < spec.gusts; n++) {
    const a = spot(200),
      angle = R() * Math.PI * 2,
      reach = 220 + R() * 260;
    gusts.push({ id: n, ax: a.x, ay: a.y, bx: clamp(a.x + Math.cos(angle) * reach, 100, spec.w - 100), by: clamp(a.y + Math.sin(angle) * reach, 100, spec.h - 100), r: 95, period: 5 + R() * 4, phase: R() });
  }
  // things that only decorate; the renderer draws them and nothing bumps into them
  const decor = [];
  for (let n = 0; n < Math.round((spec.w * spec.h) / 26000); n++) {
    const edge = n % 3 === 0,
      p = edge ? (R() < 0.5 ? { x: R() * spec.w, y: R() < 0.5 ? R() * 60 : spec.h - R() * 60 } : { x: R() < 0.5 ? R() * 60 : spec.w - R() * 60, y: R() * spec.h }) : spot(40);
    if (!edge && (ponds.some((o) => dist(p, o) < o.r + 26) || taken.some((o) => dist(p, o) < 70))) continue;
    decor.push({ ...p, kind: spec.things[Math.floor(R() * spec.things.length)], size: 0.75 + R() * 0.6, tint: R() });
  }
  return { ...spec, index: i, start, gate, ponds, rocks, solids, lanterns, sleepers, fireflies, gusts, decor };
}

/** The most one visit can score: every firefly gathered before the first lantern is lit. */
export function maxScore(world) {
  const f = world.fireflies.length;
  return f * POINTS.firefly + world.lanterns.length * (POINTS.lantern + POINTS.perFirefly * f) + world.sleepers.length * POINTS.sleeper + POINTS.gate;
}
export const starsFor = (score, world) => (score >= maxScore(world) * 0.85 ? 3 : score >= maxScore(world) * 0.55 ? 2 : 1);

/** One visit to one place. */
export class Visit {
  constructor(index = 0) {
    this.world = buildWorld(index);
    this.form = FORMS[this.world.index];
    this.x = this.world.start.x;
    this.y = this.world.start.y;
    this.vx = this.vy = 0;
    this.facing = 1;
    this.time = 0;
    this.walked = 0;
    this.score = 0;
    this.roarWait = 0;
    this.roars = 0;
    this.lit = new Set();
    this.woken = new Set();
    this.with = []; // ids of fireflies travelling with Leo, oldest first
    this.away = new Map(); // firefly id -> seconds until it can be gathered again
    this.calm = new Map(); // gust id -> seconds it stays still
    this.gustRest = 0;
    this.status = "walking"; // walking | open | done
    this.events = [];
  }
  get light() {
    return this.form.light + Math.min(140, this.with.length * 6);
  }
  get stars() {
    return starsFor(this.score, this.world);
  }
  drainEvents() {
    return this.events.splice(0);
  }
  gustAt(g, time = this.time) {
    const t = (Math.sin((time / g.period + g.phase) * Math.PI * 2) + 1) / 2;
    return { x: g.ax + (g.bx - g.ax) * t, y: g.ay + (g.by - g.ay) * t };
  }
  /** What his flame leans toward: the nearest sleeping lantern, then the gate. */
  target() {
    if (this.status === "done") return null;
    if (this.status === "open") return this.world.gate;
    let best = null;
    for (const l of this.world.lanterns) if (!this.lit.has(l.id) && (!best || dist(this, l) < dist(this, best))) best = l;
    return best;
  }
  #gather(f) {
    this.with.push(f.id);
    this.score += POINTS.firefly;
    this.events.push({ type: "gather", id: f.id, x: f.x, y: f.y, count: this.with.length });
  }
  #lightUp(l) {
    this.lit.add(l.id);
    const pts = POINTS.lantern + POINTS.perFirefly * this.with.length;
    this.score += pts;
    this.events.push({ type: "light", id: l.id, x: l.x, y: l.y, pts, count: this.lit.size, of: this.world.lanterns.length, fireflies: this.with.length });
    if (this.lit.size === this.world.lanterns.length) {
      this.status = "open";
      this.events.push({ type: "open", x: this.world.gate.x, y: this.world.gate.y });
    }
  }
  #wake(s) {
    this.woken.add(s.id);
    this.score += POINTS.sleeper;
    this.events.push({ type: "wake", id: s.id, kind: s.kind, x: s.x, y: s.y, pts: POINTS.sleeper });
  }

  update(dt, input = {}) {
    if (!(dt > 0) || this.status === "done") return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const w = this.world,
      f = this.form;
    // --- walking ---
    let dx = Number(input.dx) || 0,
      dy = Number(input.dy) || 0;
    const len = Math.hypot(dx, dy);
    if (len > 1) (dx /= len), (dy /= len);
    const ease = Math.min(1, dt * 9);
    this.vx += (dx * f.speed - this.vx) * ease;
    this.vy += (dy * f.speed - this.vy) * ease;
    const px = this.x,
      py = this.y;
    this.x = clamp(this.x + this.vx * dt, LEO_R, w.w - LEO_R);
    this.y = clamp(this.y + this.vy * dt, LEO_R, w.h - LEO_R);
    for (const o of w.solids) {
      const d = dist(this, o),
        min = o.r + LEO_R;
      if (d < min) {
        const nx = d > 0.001 ? (this.x - o.x) / d : 1,
          ny = d > 0.001 ? (this.y - o.y) / d : 0;
        this.x = o.x + nx * min;
        this.y = o.y + ny * min;
      }
    }
    this.walked += Math.hypot(this.x - px, this.y - py);
    if (Math.abs(this.vx) > 12) this.facing = Math.sign(this.vx);
    this.overWater = f.swim && w.ponds.some((o) => dist(this, o) < o.r);

    // --- roar ---
    this.roarWait = Math.max(0, this.roarWait - dt);
    let ring = 0;
    if (input.roar && this.roarWait <= 0) {
      ring = f.roar;
      this.roarWait = f.cooldown;
      this.roars++;
      this.events.push({ type: "roar", x: this.x, y: this.y, r: ring });
      for (const g of w.gusts) if (dist(this, this.gustAt(g)) < ring + g.r) this.calm.set(g.id, 9);
    }
    // --- fireflies ---
    for (const [id, left] of this.away) left - dt <= 0 ? this.away.delete(id) : this.away.set(id, left - dt);
    for (const fly of w.fireflies) {
      if (this.with.includes(fly.id) || this.away.has(fly.id)) continue;
      if (dist(this, fly) < Math.max(f.pull, ring)) this.#gather(fly);
    }
    // --- lanterns, sleepers ---
    for (const l of w.lanterns) if (!this.lit.has(l.id) && dist(this, l) < Math.max(f.touch, ring)) this.#lightUp(l);
    for (const s of w.sleepers) if (!this.woken.has(s.id) && dist(this, s) < Math.max(this.light * 0.45, ring)) this.#wake(s);
    // --- wind ---
    this.gustRest = Math.max(0, this.gustRest - dt);
    for (const [id, left] of this.calm) left - dt <= 0 ? this.calm.delete(id) : this.calm.set(id, left - dt);
    if (!f.guard && this.with.length && this.gustRest <= 0)
      for (const g of w.gusts) {
        if (this.calm.has(g.id) || dist(this, this.gustAt(g)) > g.r) continue;
        const lost = this.with.splice(-Math.ceil(this.with.length / 2));
        for (const id of lost) this.away.set(id, 2.5);
        this.score -= lost.length * POINTS.firefly;
        this.gustRest = 3;
        this.events.push({ type: "scatter", lost, x: this.x, y: this.y });
        break;
      }
    // --- the gate ---
    if (this.status === "open" && dist(this, w.gate) < 62) {
      this.status = "done";
      this.score += POINTS.gate;
      this.events.push({ type: "done", score: this.score, stars: this.stars });
    }
  }
}

/** A stand-in player for tests and the title screen: fireflies first, then sleepers, lanterns, the gate. */
export function guide(visit, { thorough = true } = {}) {
  const w = visit.world,
    near = (list) => list.reduce((best, p) => (!best || dist(visit, p) < dist(visit, best) ? p : best), null);
  let goal = null;
  if (thorough) goal = near(w.fireflies.filter((f) => !visit.with.includes(f.id) && !visit.away.has(f.id)));
  if (thorough) goal ??= near(w.sleepers.filter((s) => !visit.woken.has(s.id)));
  goal ??= near(w.lanterns.filter((l) => !visit.lit.has(l.id)));
  goal ??= w.gate;
  let dx = goal.x - visit.x,
    dy = goal.y - visit.y;
  const d = Math.hypot(dx, dy) || 1;
  (dx /= d), (dy /= d);
  // lean sideways when something solid is straight ahead, so the walk slides round it
  for (const o of w.solids) {
    const ox = o.x - visit.x,
      oy = o.y - visit.y,
      along = ox * dx + oy * dy,
      side = ox * dy - oy * dx;
    if (along > 0 && along < o.r + 90 && Math.abs(side) < o.r + LEO_R + 6) {
      const turn = side >= 0 ? -1 : 1;
      [dx, dy] = [dx * 0.35 - dy * turn * -1 * 0.94, dy * 0.35 + dx * turn * -1 * 0.94];
      break;
    }
  }
  // wait for the wind to pass rather than walk the fireflies into it
  if (!visit.form.guard && visit.with.length)
    for (const g of w.gusts) {
      const at = visit.gustAt(g);
      if (!visit.calm.has(g.id) && Math.hypot(at.x - visit.x, at.y - visit.y) < g.r + 70) return { dx: (visit.x - at.x) / 100, dy: (visit.y - at.y) / 100, roar: visit.roarWait <= 0 };
    }
  return { dx, dy, roar: false };
}
