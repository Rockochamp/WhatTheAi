// Leos Smash Racer — Claude Fable 5.2 edition. The race, without drawing.
// A road that runs into the screen, toys to smash on it, seven rivals to
// pass. Nothing can go wrong: crashing into things is the point.
import { rng, clamp } from "../../../js/fable/kit.js?v=1";

export const VERSION = "claude_fable_5_2";
export const RULESET = 1;
export const STEP = 1 / 60;
export const SEG = 200; // length of one road segment
export const RACERS = 8;
export const MAX_COMBO = 5;
export const BOOST_TIME = 2.6;

export const CARS = [
  { id: "rocket", name: { en: "Red Rocket", de: "Rote Rakete" }, color: "#ff4d4d", trim: "#ffd23b", speed: 1.04, steer: 0.95, smash: 1 },
  { id: "digger", name: { en: "Big Digger", de: "Grosser Bagger" }, color: "#ffb72b", trim: "#3a3a3a", speed: 0.96, steer: 0.95, smash: 1.4 },
  { id: "frog", name: { en: "Zippy Frog", de: "Flitzefrosch" }, color: "#4fd06a", trim: "#fff7d6", speed: 1, steer: 1.2, smash: 1 },
  { id: "police", name: { en: "Blue Light", de: "Blaulicht" }, color: "#3d7bff", trim: "#ffffff", speed: 1.02, steer: 1.05, smash: 1.1 },
  { id: "ice", name: { en: "Ice Cream Van", de: "Glacewagen" }, color: "#ff9ed1", trim: "#8ff0ff", speed: 0.98, steer: 1.1, smash: 1.2 },
  { id: "dino", name: { en: "Dino Truck", de: "Dino-Truck" }, color: "#9b6bff", trim: "#b8f400", speed: 1, steer: 1, smash: 1.3 },
];
export const TRACKS = [
  { id: "hills", name: { en: "Sunny Hills", de: "Sonnenhügel" }, seed: 11, curves: 1, hills: 1.2, sky: ["#62c7ff", "#d8f3ff"], grass: ["#59c15b", "#4fb551"], road: ["#6f7480", "#686d79"], rumble: ["#ffffff", "#ff5a5a"], side: "tree" },
  { id: "canyon", name: { en: "Sandbox Canyon", de: "Sandkasten-Schlucht" }, seed: 23, curves: 1.5, hills: 0.7, sky: ["#ffb26b", "#ffe9c2"], grass: ["#e8c27a", "#deb66c"], road: ["#8a6f5a", "#836853"], rumble: ["#fff3d6", "#3d7bff"], side: "cactus" },
  { id: "night", name: { en: "Night City", de: "Nachtstadt" }, seed: 37, curves: 1.2, hills: 0.5, sky: ["#141a4a", "#4a2a7a"], grass: ["#22306a", "#1d2a5e"], road: ["#3a3f55", "#35394e"], rumble: ["#ffe45c", "#ff4dd2"], side: "tower" },
];
export const SMASHABLES = {
  crates: { points: 50, width: 0.26, boost: 0.1 },
  wall: { points: 90, width: 0.5, boost: 0.14 },
  duck: { points: 120, width: 0.3, boost: 0.16 },
  cones: { points: 30, width: 0.22, boost: 0.07 },
};
export const PLACE_BONUS = [3000, 2200, 1700, 1300, 1000, 800, 600, 400];

/** Builds a road: curves and hills from a seed, toys on the tarmac, scenery beside it. */
export function buildTrack(id = "hills") {
  const spec = TRACKS.find((t) => t.id === id) ?? TRACKS[0],
    R = rng(spec.seed),
    segments = [];
  let y = 0;
  const ease = (a, b, t) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);
  const add = (enter, hold, leave, curve, hill) => {
    const start = y,
      end = y + hill * SEG * 0.25,
      total = enter + hold + leave;
    for (let n = 0; n < total; n++) {
      const c = n < enter ? ease(0, curve, n / enter) : n < enter + hold ? curve : ease(curve, 0, (n - enter - hold) / leave);
      y = ease(start, end, (n + 1) / total);
      segments.push({ index: segments.length, curve: c, y, things: [] });
    }
  };
  add(40, 40, 20, 0, 0); // a straight to start on
  while (segments.length < 3900) {
    const kind = R(),
      len = 30 + Math.floor(R() * 50),
      curve = kind < 0.3 ? 0 : (R() < 0.5 ? -1 : 1) * (1.5 + R() * 3.5) * spec.curves,
      hill = (R() - 0.5) * 2 * 60 * spec.hills;
    add(len, len, len, curve, R() < 0.6 ? hill : 0);
  }
  add(30, 60, 30, 0, 0); // and one to finish on
  const finish = segments.length - 60,
    kinds = Object.keys(SMASHABLES);
  for (let i = 70; i < finish - 20; i += 13 + Math.floor(R() * 16)) {
    const kind = kinds[Math.floor(R() * kinds.length)],
      offset = kind === "wall" ? (R() < 0.5 ? -0.42 : 0.42) : [-0.62, 0, 0.62][Math.floor(R() * 3)];
    segments[i].things.push({ kind, offset, smashed: false, solid: true });
    if (R() < 0.3 && kind !== "wall") segments[i].things.push({ kind: "cones", offset: -offset || 0.62, smashed: false, solid: true });
  }
  for (let i = 4; i < segments.length; i += 4) {
    const side = i % 8 ? 1 : -1;
    segments[i].things.push({ kind: spec.side, offset: side * (1.35 + R() * 1.6), solid: false, tall: 0.7 + R() * 0.7 });
  }
  segments[finish].finish = true;
  return { ...spec, segments, length: finish * SEG };
}

export class Race {
  constructor({ track = "hills", car = "rocket", assist = true, boost = 0 } = {}) {
    this.track = typeof track === "string" ? buildTrack(track) : track;
    this.car = CARS.find((c) => c.id === car) ?? CARS[0];
    this.assist = !!assist;
    this.maxSpeed = SEG * 58 * this.car.speed;
    this.z = 0;
    this.x = 0;
    this.speed = 0;
    this.boost = clamp(boost, 0, 1);
    this.boosting = 0;
    this.combo = 0;
    this.comboLeft = 0;
    this.bestCombo = 0;
    this.points = 0;
    this.smashed = 0;
    this.time = 0;
    this.count = 3;
    this.status = "countdown"; // countdown | racing | finished
    this.place = RACERS;
    this.events = [{ type: "count", n: 3 }];
    const pace = this.assist ? 0.985 : 1;
    this.rivals = Array.from({ length: RACERS - 1 }, (_, i) => ({
      id: i,
      car: CARS[(CARS.indexOf(this.car) + 1 + i) % CARS.length],
      z: (i + 1) * SEG * 7,
      lane: [-0.6, 0, 0.6][i % 3],
      x: [-0.6, 0, 0.6][i % 3],
      speed: this.maxSpeed * (0.93 + i * 0.015) * pace,
      bumped: 0,
      phase: i * 1.7,
    }));
  }
  get segment() {
    return this.track.segments[Math.floor(this.z / SEG) % this.track.segments.length];
  }
  get progress() {
    return clamp(this.z / this.track.length, 0, 1);
  }
  get score() {
    return Math.round(this.points);
  }
  get stars() {
    return this.status !== "finished" ? 0 : this.place === 1 ? 3 : this.place <= 3 ? 2 : 1;
  }
  drainEvents() {
    return this.events.splice(0);
  }
  /** Where a helper would steer: at the next toy to smash, else back to the middle. */
  helperTarget() {
    const from = Math.floor(this.z / SEG);
    for (let n = 2; n < 16; n++) {
      const seg = this.track.segments[from + n];
      if (!seg) break;
      for (const t of seg.things) if (t.solid && !t.smashed) return t.offset;
    }
    return 0;
  }

  update(dt, input = {}) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.05);
    if (this.status === "finished") {
      // roll on past the line and come to a stop; nothing counts any more
      this.speed *= Math.exp(-1.7 * dt);
      this.z = Math.min(this.z + this.speed * dt, this.track.length + SEG * 44);
      this.boosting = 0;
      return;
    }
    if (this.status === "countdown") {
      const before = Math.ceil(this.count);
      this.count -= dt;
      const now = Math.ceil(this.count);
      if (now !== before) this.events.push(now > 0 ? { type: "count", n: now } : { type: "go" });
      if (this.count <= 0) this.status = "racing";
      return;
    }
    this.time += dt;
    const seg = this.segment,
      max = this.maxSpeed * (this.boosting > 0 ? 1.3 : 1),
      pct = this.speed / this.maxSpeed;
    // --- the car ---
    let steer = clamp(Number(input.steer) || 0, -1, 1);
    if (this.assist) {
      const pull = clamp((this.helperTarget() - this.x) * 2.2, -1, 1);
      steer = steer ? steer * 0.8 + pull * 0.2 : pull * 0.22;
    }
    this.x += steer * dt * 2.1 * this.car.steer * Math.min(1, pct + 0.3);
    this.x -= seg.curve * pct * pct * dt * (this.assist ? 0.16 : 0.34); // the bend pushes outward
    const limit = this.assist ? 1.05 : 2;
    this.x = clamp(this.x, -limit, limit);
    const off = Math.abs(this.x) > 1.08;
    this.speed += (off ? -this.maxSpeed * 0.9 * (pct > 0.45 ? 1 : 0) : this.maxSpeed * 0.42) * dt;
    if (this.boosting > 0) this.speed += this.maxSpeed * 1.2 * dt;
    this.speed = clamp(this.speed, 0, max);
    if (this.boosting > 0) {
      this.boosting -= dt;
      if (this.boosting <= 0) this.events.push({ type: "boostEnd" });
    } else if (input.boost && this.boost >= 1) {
      this.boost = 0;
      this.boosting = BOOST_TIME;
      this.events.push({ type: "boost" });
    }
    this.comboLeft -= dt;
    if (this.comboLeft <= 0) this.combo = 0;
    const before = this.z;
    this.z += this.speed * dt;

    // --- toys on the road ---
    for (let i = Math.floor(before / SEG); i <= Math.floor(this.z / SEG); i++) {
      const s = this.track.segments[i];
      if (!s) continue;
      for (const t of s.things) {
        if (!t.solid || t.smashed) continue;
        const kind = SMASHABLES[t.kind];
        if (Math.abs(t.offset - this.x) > kind.width + 0.17) continue;
        t.smashed = true;
        this.smashed++;
        this.combo = Math.min(MAX_COMBO, this.combo + 1);
        this.comboLeft = 2.4;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        const pts = kind.points * this.combo * this.car.smash * (this.boosting > 0 ? 2 : 1);
        this.points += pts;
        const ready = this.boost < 1;
        this.boost = Math.min(1, this.boost + kind.boost);
        if (this.boosting <= 0) this.speed *= 0.93;
        this.events.push({ type: "smash", kind: t.kind, offset: t.offset, index: i, pts: Math.round(pts), combo: this.combo });
        if (ready && this.boost >= 1) this.events.push({ type: "boostReady" });
      }
    }

    // --- the others ---
    let ahead = 0;
    for (const r of this.rivals) {
      const was = r.z > before;
      r.bumped = Math.max(0, r.bumped - dt);
      r.z += r.speed * (r.bumped > 0 ? 0.55 : 1) * dt;
      r.x += (r.lane + Math.sin(this.time * 0.6 + r.phase) * 0.2 - r.x) * Math.min(1, dt * 2);
      const gap = r.z - this.z;
      if (gap > 0 && gap < SEG * 0.9 && Math.abs(r.x - this.x) < 0.42 && this.speed > r.speed && r.bumped <= 0) {
        r.bumped = 1.6;
        r.lane = r.x > this.x ? Math.min(0.8, r.lane + 0.5) : Math.max(-0.8, r.lane - 0.5);
        this.points += 80;
        if (this.boosting <= 0) this.speed *= 0.9;
        this.events.push({ type: "bump", x: r.x });
      }
      const is = r.z > this.z;
      if (was && !is) this.events.push({ type: "pass" });
      if (!was && is) this.events.push({ type: "passed" });
      if (is) ahead++;
    }
    this.place = ahead + 1;
    if (this.z >= this.track.length) {
      this.status = "finished";
      this.points += PLACE_BONUS[this.place - 1] + Math.max(0, Math.round((100 - this.time) * 10));
      this.events.push({ type: "finish", place: this.place, stars: this.stars });
    }
  }
}

/** A stand-in driver for tests: steers at toys like the helper, boosts when it can. */
export function driver(race, skill = 1) {
  const target = race.helperTarget(),
    d = target - race.x;
  return { steer: Math.abs(d) < 0.05 ? 0 : Math.sign(d) * skill, boost: race.boost >= 1 };
}
