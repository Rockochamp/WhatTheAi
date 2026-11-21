// Draws the race: a road running into the screen, built from flat slices,
// with toys, scenery and cars drawn as simple shapes that grow as they near.
import { clamp, TAU } from "../../../js/fable/kit.js?v=1";
import { SEG } from "./sim.js?v=1";

const ROAD = 2000, // half the road's width in world units
  CAM_H = 1000,
  DEPTH = 0.84,
  BEHIND = CAM_H * DEPTH, // the camera rides this far behind the car
  DRAW = 170;
const BLOCKS = ["#ff4d4d", "#3d7bff", "#ffd23b", "#4fd06a", "#ff9ed1", "#9b6bff"];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext("2d", { alpha: false });
    this.bits = [];
    this.words = [];
    this.t = 0;
    this.skyShift = 0;
    this.view = { w: 1, h: 1, dpr: 1 };
  }
  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, w * h > 1.5e6 ? 1.5 : 2);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.view = { w, h, dpr };
  }
  reset() {
    this.bits.length = this.words.length = 0;
  }
  /** Fling coloured blocks from where a toy stood. */
  smash(race, e) {
    const seg = race.track.segments[e.index],
      at = seg?.screen;
    const { w, h } = this.view,
      x = at ? at.x + at.w * e.offset : w / 2,
      y = at ? Math.min(at.y, h * 0.86) : h * 0.7,
      size = at ? clamp(at.w * 0.09, 6, 34) : 18;
    for (let i = 0; i < (this.reduced ? 6 : 16) && this.bits.length < 220; i++)
      this.bits.push({ x, y, vx: (Math.random() - 0.5) * w * 0.9, vy: -h * (0.25 + Math.random() * 0.75), s: size * (0.5 + Math.random()), c: e.kind === "duck" ? "#ffd93b" : e.kind === "cones" ? "#ff8a2b" : BLOCKS[i % BLOCKS.length], r: Math.random() * 6, life: 1.1 });
    this.words.push({ x, y: y - size * 2, text: e.combo > 1 ? `×${e.combo}  +${e.pts}` : `+${e.pts}`, life: 0.9, big: e.combo >= 4 });
  }

  draw(race, dt, { reduced = false } = {}) {
    const g = this.g,
      { w, h, dpr } = this.view,
      track = race.track,
      segs = track.segments,
      half = Math.max(w, h * 0.9) / 2,
      horizon = h * 0.46;
    this.reduced = reduced;
    this.t += dt;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sky, and something on the horizon that slides as the road bends
    const sky = g.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, track.sky[0]);
    sky.addColorStop(1, track.sky[1]);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    this.skyShift += race.segment.curve * (race.speed / race.maxSpeed) * dt * 30;
    g.fillStyle = track.id === "night" ? "#fff6c8" : "#fff3a8";
    g.beginPath();
    g.arc(w * 0.72 - this.skyShift * 0.3, h * 0.16, Math.min(w, h) * 0.07, 0, TAU);
    g.fill();
    g.fillStyle = track.grass[1];
    g.globalAlpha = 0.55;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w + 24; x += 24) g.lineTo(x, horizon - 18 - 46 * Math.abs(Math.sin((x + this.skyShift * 3) * 0.006)) - 22 * Math.sin((x + this.skyShift * 3) * 0.017));
    g.lineTo(w, h);
    g.fill();
    g.globalAlpha = 1;

    const camZ = Math.max(0, race.z - BEHIND),
      base = Math.floor(camZ / SEG),
      frac = (camZ % SEG) / SEG,
      here = segs[Math.min(segs.length - 1, Math.floor(race.z / SEG))],
      before = segs[Math.max(0, Math.floor(race.z / SEG) - 1)],
      carFrac = (race.z % SEG) / SEG,
      camY = CAM_H + before.y + (here.y - before.y) * carFrac,
      camX = race.x * ROAD;
    const project = (wx, wy, wz) => {
      const cz = Math.max(1, wz - camZ),
        s = DEPTH / cz;
      return { x: w / 2 + s * (wx - camX) * half, y: horizon - s * (wy - camY) * (h / 2), w: s * ROAD * half, s };
    };
    let x = 0,
      dx = -(segs[base]?.curve ?? 0) * frac,
      maxy = h,
      prevY = segs[Math.max(0, base - 1)]?.y ?? 0;
    for (let n = 0; n < DRAW; n++) {
      const seg = segs[base + n];
      if (!seg) break;
      const z1 = (base + n) * SEG,
        p1 = project(x, prevY, z1),
        p2 = project(x + dx, seg.y, z1 + SEG);
      x += dx;
      dx += seg.curve;
      prevY = seg.y;
      seg.screen = p1;
      seg.clip = maxy;
      seg.seen = this.t;
      if (z1 + SEG <= camZ + 1 || p2.y >= maxy) continue;
      const alt = Math.floor((base + n) / 3) % 2,
        y1 = Math.min(p1.y, maxy),
        y2 = p2.y;
      g.fillStyle = track.grass[alt];
      g.fillRect(0, y2, w, y1 - y2 + 1);
      const quad = (l1, r1, l2, r2, color) => {
        g.fillStyle = color;
        g.beginPath();
        g.moveTo(l1, p1.y + 1);
        g.lineTo(r1, p1.y + 1);
        g.lineTo(r2, p2.y);
        g.lineTo(l2, p2.y);
        g.fill();
      };
      quad(p1.x - p1.w * 1.12, p1.x + p1.w * 1.12, p2.x - p2.w * 1.12, p2.x + p2.w * 1.12, track.rumble[alt]);
      quad(p1.x - p1.w, p1.x + p1.w, p2.x - p2.w, p2.x + p2.w, track.road[alt]);
      if (alt)
        for (const lane of [-1 / 3, 1 / 3]) quad(p1.x + p1.w * (lane - 0.012), p1.x + p1.w * (lane + 0.012), p2.x + p2.w * (lane - 0.012), p2.x + p2.w * (lane + 0.012), "rgba(255,255,255,0.75)");
      if (seg.finish) quad(p1.x - p1.w, p1.x + p1.w, p2.x - p2.w, p2.x + p2.w, "#ffffff");
      maxy = y2;
    }
    // things and cars, far to near
    const rivalsAt = new Map();
    for (const r of race.rivals) {
      const i = Math.floor(r.z / SEG);
      if (!rivalsAt.has(i)) rivalsAt.set(i, []);
      rivalsAt.get(i).push(r);
    }
    for (let n = DRAW - 1; n >= 0; n--) {
      const seg = segs[base + n];
      if (!seg || seg.seen !== this.t) continue;
      const p = seg.screen;
      if (p.s <= 0 || (base + n) * SEG < camZ + SEG * 0.5) continue;
      g.save();
      g.beginPath();
      g.rect(0, 0, w, seg.clip);
      g.clip();
      if (seg.finish) this.banner(g, p);
      for (const t of seg.things) if (!t.smashed) this.thing(g, t, p.x + p.w * t.offset, p.y, p.w, base + n);
      for (const r of rivalsAt.get(base + n) ?? []) this.car(g, r.car, p.x + p.w * r.x, p.y, p.w * 0.36, 0, r.bumped > 0 ? Math.sin(this.t * 30) * 0.2 : 0);
      g.restore();
    }
    // the player's car
    const cw = clamp(w * 0.2, 96, 190),
      bounce = reduced ? 0 : Math.sin(this.t * 34) * (race.speed / race.maxSpeed) * 1.6;
    if (race.boosting > 0 && !reduced) {
      g.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + this.t,
          r1 = Math.max(w, h) * 0.3,
          r2 = Math.max(w, h) * (0.45 + 0.2 * Math.sin(this.t * 20 + i));
        g.beginPath();
        g.moveTo(w / 2 + Math.cos(a) * r1, horizon + Math.sin(a) * r1 * 0.6);
        g.lineTo(w / 2 + Math.cos(a + 0.012) * r2 * 1.6, horizon + Math.sin(a + 0.012) * r2);
        g.lineTo(w / 2 + Math.cos(a - 0.012) * r2 * 1.6, horizon + Math.sin(a - 0.012) * r2);
        g.fill();
      }
    }
    this.car(g, race.car, w / 2, h - Math.max(18, h * 0.045) + bounce, cw, race.boosting > 0 ? 1 : 0, clamp((race.steerShown ?? 0) * 0.12, -0.14, 0.14));
    // flying blocks and score pops
    for (const b of this.bits) {
      b.life -= dt;
      b.vy += h * 2.4 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.r += dt * 9;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.r);
      g.globalAlpha = clamp(b.life * 2, 0, 1);
      g.fillStyle = b.c;
      g.fillRect(-b.s / 2, -b.s / 2, b.s, b.s);
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 2;
      g.strokeRect(-b.s / 2, -b.s / 2, b.s, b.s);
      g.restore();
    }
    this.bits = this.bits.filter((b) => b.life > 0 && b.y < h + 60);
    g.textAlign = "center";
    g.lineJoin = "round";
    for (const q of this.words) {
      q.life -= dt;
      g.globalAlpha = clamp(q.life * 3, 0, 1);
      g.font = `700 ${q.big ? 40 : 28}px Fredoka, system-ui, sans-serif`;
      g.lineWidth = 6;
      g.strokeStyle = "#1c2340";
      g.strokeText(q.text, clamp(q.x, 70, w - 70), q.y - (0.9 - q.life) * 60);
      g.fillStyle = q.big ? "#ffe45c" : "#ffffff";
      g.fillText(q.text, clamp(q.x, 70, w - 70), q.y - (0.9 - q.life) * 60);
    }
    this.words = this.words.filter((q) => q.life > 0);
    g.globalAlpha = 1;
  }

  banner(g, p) {
    const top = p.y - p.w * 0.9,
      cell = (p.w * 2.2) / 14;
    g.fillStyle = "#1c2340";
    g.fillRect(p.x - p.w * 1.14, top, p.w * 0.06, p.w * 0.9);
    g.fillRect(p.x + p.w * 1.08, top, p.w * 0.06, p.w * 0.9);
    for (let i = 0; i < 14; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? "#1c2340" : "#ffffff";
        g.fillRect(p.x - p.w * 1.1 + i * cell, top + j * cell, cell + 0.5, cell + 0.5);
      }
  }
  thing(g, t, x, y, u, seed) {
    const box = (bx, by, s, c) => {
      g.fillStyle = c;
      g.fillRect(bx, by, s, s);
      g.strokeStyle = "rgba(0,0,0,0.3)";
      g.lineWidth = Math.max(1, s * 0.07);
      g.strokeRect(bx, by, s, s);
    };
    switch (t.kind) {
      case "crates": {
        const s = u * 0.2;
        for (let i = 0; i < 3; i++) box(x - s / 2 + (i === 1 ? s * 0.12 : 0), y - s * (i + 1), s, BLOCKS[(seed + i) % BLOCKS.length]);
        break;
      }
      case "wall": {
        const s = u * 0.2;
        for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) box(x - s * 2 + c * s, y - s * (r + 1), s, BLOCKS[(seed + r * 3 + c) % BLOCKS.length]);
        break;
      }
      case "duck": {
        const r = u * 0.17;
        g.fillStyle = "#ffd93b";
        g.beginPath();
        g.arc(x, y - r, r, 0, TAU);
        g.moveTo(x + r * 1.12, y - r * 2.1);
        g.arc(x + r * 0.5, y - r * 2.1, r * 0.62, 0, TAU);
        g.fill();
        g.fillStyle = "#ff8a2b";
        g.fillRect(x + r * 0.95, y - r * 2.15, r * 0.55, r * 0.26);
        g.fillStyle = "#1c2340";
        g.beginPath();
        g.arc(x + r * 0.7, y - r * 2.3, r * 0.1, 0, TAU);
        g.fill();
        break;
      }
      case "cones": {
        const s = u * 0.1;
        for (const o of [-1.3, 0, 1.3]) {
          g.fillStyle = "#ff8a2b";
          g.beginPath();
          g.moveTo(x + o * s - s * 0.6, y);
          g.lineTo(x + o * s + s * 0.6, y);
          g.lineTo(x + o * s, y - s * 1.9);
          g.fill();
          g.fillStyle = "#fff";
          g.fillRect(x + o * s - s * 0.3, y - s * 1.05, s * 0.6, s * 0.3);
        }
        break;
      }
      case "tree": {
        const s = u * 0.5 * t.tall;
        g.fillStyle = "#7a5230";
        g.fillRect(x - s * 0.09, y - s * 0.9, s * 0.18, s * 0.9);
        g.fillStyle = "#2f9e4f";
        g.beginPath();
        g.arc(x, y - s * 1.3, s * 0.55, 0, TAU);
        g.moveTo(x, y - s * 0.95);
        g.arc(x - s * 0.35, y - s * 0.95, s * 0.38, 0, TAU);
        g.moveTo(x + s * 0.73, y - s * 0.95);
        g.arc(x + s * 0.35, y - s * 0.95, s * 0.38, 0, TAU);
        g.fill();
        break;
      }
      case "cactus": {
        const s = u * 0.42 * t.tall;
        g.strokeStyle = "#3f9a55";
        g.lineCap = "round";
        g.lineWidth = s * 0.26;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y - s * 1.3);
        g.moveTo(x - s * 0.42, y - s * 0.9);
        g.lineTo(x - s * 0.42, y - s * 0.5);
        g.lineTo(x, y - s * 0.5);
        g.moveTo(x + s * 0.42, y - s * 1.1);
        g.lineTo(x + s * 0.42, y - s * 0.75);
        g.lineTo(x, y - s * 0.75);
        g.stroke();
        break;
      }
      case "tower": {
        const s = u * 0.5,
          hgt = s * (1.6 + t.tall * 2);
        g.fillStyle = "#1a2152";
        g.fillRect(x - s * 0.45, y - hgt, s * 0.9, hgt);
        g.fillStyle = "#ffe45c";
        for (let r = 0; r < Math.floor(hgt / (s * 0.34)) - 1; r++)
          for (let c = 0; c < 3; c++) if ((seed + r * 3 + c * 5) % 3) g.fillRect(x - s * 0.33 + c * s * 0.25, y - hgt + s * 0.16 + r * s * 0.34, s * 0.14, s * 0.18);
        break;
      }
    }
  }
  /** A toy car seen from behind. `w` is its width in pixels. */
  car(g, car, x, y, w, flame = 0, lean = 0) {
    const hgt = w * 0.56;
    g.save();
    g.translate(x, y);
    g.rotate(lean);
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.ellipse(0, 0, w * 0.56, w * 0.09, 0, 0, TAU);
    g.fill();
    if (flame) {
      g.fillStyle = "#ffd23b";
      for (const o of [-0.22, 0.22]) {
        g.beginPath();
        g.moveTo(o * w - w * 0.07, -hgt * 0.2);
        g.lineTo(o * w + w * 0.07, -hgt * 0.2);
        g.lineTo(o * w, hgt * (0.3 + Math.random() * 0.4));
        g.fill();
      }
    }
    g.fillStyle = "#1c2340";
    g.beginPath();
    g.roundRect(-w * 0.52, -hgt * 0.42, w * 0.2, hgt * 0.42, w * 0.05);
    g.roundRect(w * 0.32, -hgt * 0.42, w * 0.2, hgt * 0.42, w * 0.05);
    g.fill();
    g.fillStyle = car.color;
    g.beginPath();
    g.roundRect(-w * 0.44, -hgt * 0.7, w * 0.88, hgt * 0.56, w * 0.1);
    g.fill();
    g.beginPath();
    g.roundRect(-w * 0.3, -hgt, w * 0.6, hgt * 0.42, w * 0.1);
    g.fill();
    g.fillStyle = "rgba(20,30,70,0.75)";
    g.beginPath();
    g.roundRect(-w * 0.23, -hgt * 0.93, w * 0.46, hgt * 0.24, w * 0.05);
    g.fill();
    g.fillStyle = car.trim;
    g.fillRect(-w * 0.44, -hgt * 0.42, w * 0.88, hgt * 0.07);
    g.fillStyle = "#ff3b3b";
    g.fillRect(-w * 0.38, -hgt * 0.6, w * 0.14, hgt * 0.1);
    g.fillRect(w * 0.24, -hgt * 0.6, w * 0.14, hgt * 0.1);
    g.restore();
  }
}
