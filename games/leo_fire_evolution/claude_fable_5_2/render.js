// Draws a place at night: the ground and everything on it, then the dark
// laid over it with a hole wherever something is burning.
import { clamp, TAU } from "../../../js/fable/kit.js?v=1";
import { FORMS } from "./world.js?v=1";

const hash = (a, b) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const FUR = "#f2b25a",
  FUR_DARK = "#c9853a",
  INK = "#2a1a2e";

/** A flame made of tongues. `lean` tips it toward something, as a compass would. */
export function flame(g, x, y, size, look, t, lean = { x: 0, y: 0 }, calm = false) {
  const n = look.tongues,
    wob = calm ? 0.12 : 0.35;
  g.save();
  g.translate(x, y);
  if (look.rays) {
    g.strokeStyle = look.colors[1];
    g.globalAlpha = 0.5;
    g.lineWidth = size * 0.07;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU + t * 0.4,
        r1 = size * 1.5,
        r2 = size * (1.9 + 0.25 * Math.sin(t * 3 + k));
      g.beginPath();
      g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1 - size * 0.5);
      g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2 - size * 0.5);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  if (look.wings)
    for (const side of [-1, 1]) {
      const flap = Math.sin(t * 5) * 0.18;
      g.fillStyle = look.colors[1];
      g.beginPath();
      g.moveTo(side * size * 0.3, size * 0.2);
      g.quadraticCurveTo(side * size * 1.6, -size * (0.9 + flap), side * size * 2.3, -size * (0.2 + flap));
      g.quadraticCurveTo(side * size * 1.5, size * 0.1, side * size * 1.2, size * 0.7);
      g.quadraticCurveTo(side * size * 0.8, size * 0.3, side * size * 0.3, size * 0.2);
      g.fill();
    }
  for (let layer = 2; layer >= 0; layer--) {
    const s = size * [0.42, 0.7, 1][layer];
    g.fillStyle = look.colors[layer];
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const a = ((k + 0.5) / n - 0.5) * 3.6,
        h = s * look.height * (0.85 + wob * Math.sin(t * (6 + (k % 3)) + k * 1.9 + layer)),
        bx = Math.sin(a) * s * 0.55,
        by = -Math.cos(a) * s * 0.3,
        tx = Math.sin(a) * h * 1.15 + lean.x * h * 0.5,
        ty = -Math.abs(Math.cos(a * 0.5)) * h * 1.25 + lean.y * h * 0.5,
        half = (s * 1.7) / n;
      g.moveTo(bx - half, by + s * 0.25);
      g.quadraticCurveTo(bx - half * 0.6 + (tx - bx) * 0.3, by + (ty - by) * 0.55, tx, ty);
      g.quadraticCurveTo(bx + half * 0.6 + (tx - bx) * 0.3, by + (ty - by) * 0.55, bx + half, by + s * 0.25);
    }
    g.ellipse(0, s * 0.05, s * 0.62, s * 0.42, 0, 0, TAU);
    g.fill();
  }
  if (look.horns) {
    g.strokeStyle = look.colors[2];
    g.lineWidth = size * 0.16;
    g.lineCap = "round";
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(side * size * 0.45, -size * 0.2);
      g.quadraticCurveTo(side * size * 0.95, -size * 0.6, side * size * 0.7, -size * 1.15);
      g.stroke();
    }
  }
  const dots = (count, radius, color, twinkle) => {
    g.fillStyle = color;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * TAU + t * (twinkle ? 0.5 : 2.2),
        r = size * radius * (twinkle ? 1 + 0.2 * Math.sin(t * 2 + k * 2) : 1),
        px = Math.cos(a) * r,
        py = Math.sin(a) * r * 0.55 - size * 0.4,
        d = size * (twinkle ? 0.13 * (0.6 + 0.4 * Math.sin(t * 6 + k * 3)) : 0.1);
      g.beginPath();
      if (twinkle) {
        g.moveTo(px, py - d * 2);
        g.quadraticCurveTo(px, py, px + d * 2, py);
        g.quadraticCurveTo(px, py, px, py + d * 2);
        g.quadraticCurveTo(px, py, px - d * 2, py);
        g.quadraticCurveTo(px, py, px, py - d * 2);
      } else g.arc(px, py, d, 0, TAU);
      g.fill();
    }
  };
  if (look.orbit) dots(look.orbit, 1.5, look.colors[0], false);
  if (look.stars) dots(5, 1.7, "#ffffff", true);
  if (look.embers) dots(4, 1.2, look.colors[2], false);
  g.restore();
}

/** The cub. `u` is his size in pixels (about his head's width). */
export function cub(g, x, y, u, { facing = 1, stride = 0, look = FORMS[0].look, t = 0, lean, hover = 0, calm = false } = {}) {
  g.save();
  g.translate(x, y);
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.beginPath();
  g.ellipse(0, u * 0.1, u * (0.95 - hover * 0.25), u * 0.26, 0, 0, TAU);
  g.fill();
  g.translate(0, -hover * u * 0.55);
  g.scale(facing, 1);
  const step = Math.sin(stride);
  // tail with a flame at the tip
  g.strokeStyle = FUR_DARK;
  g.lineWidth = u * 0.14;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(-u * 0.7, -u * 0.45);
  g.quadraticCurveTo(-u * 1.25, -u * 0.5, -u * 1.2, -u * (1 + step * 0.05));
  g.stroke();
  g.scale(facing, 1);
  flame(g, facing * -u * 1.2, -u * 1.05, u * 0.26, { ...look, rays: false, wings: false, orbit: 0, stars: false, horns: false, embers: false, tongues: 3 }, t + 2, undefined, calm);
  g.scale(facing, 1);
  // legs
  g.fillStyle = FUR_DARK;
  for (const [lx, phase] of [[-0.5, 0], [-0.25, Math.PI], [0.2, Math.PI], [0.45, 0]]) {
    const lift = hover ? 0.5 : Math.max(0, Math.sin(stride + phase)) * 0.22;
    g.beginPath();
    g.roundRect(lx * u - u * 0.11, -u * (0.3 + lift), u * 0.22, u * 0.34, u * 0.1);
    g.fill();
  }
  // body, head
  g.fillStyle = FUR;
  g.beginPath();
  g.ellipse(-u * 0.05, -u * 0.52, u * 0.72, u * 0.4, 0, 0, TAU);
  g.fill();
  const hx = u * 0.5,
    hy = -u * (0.95 + Math.abs(step) * 0.04);
  g.scale(facing, 1);
  flame(g, facing * hx, hy - u * 0.25, u * 0.62, look, t, lean, calm);
  g.scale(facing, 1);
  g.fillStyle = FUR;
  for (const ex of [-0.34, 0.34]) {
    g.beginPath();
    g.arc(hx + ex * u, hy - u * 0.36, u * 0.17, 0, TAU);
    g.fill();
  }
  g.beginPath();
  g.arc(hx, hy, u * 0.5, 0, TAU);
  g.fill();
  g.fillStyle = "#ffe2b0";
  g.beginPath();
  g.ellipse(hx + u * 0.1, hy + u * 0.17, u * 0.26, u * 0.2, 0, 0, TAU);
  g.fill();
  g.fillStyle = INK;
  const blink = Math.sin(t * 0.9) > 0.985 ? 0.15 : 1;
  for (const ex of [-0.12, 0.3]) {
    g.beginPath();
    g.ellipse(hx + ex * u, hy - u * 0.06, u * 0.065, u * 0.09 * blink, 0, 0, TAU);
    g.fill();
  }
  g.beginPath();
  g.ellipse(hx + u * 0.12, hy + u * 0.1, u * 0.07, u * 0.05, 0, 0, TAU);
  g.fill();
  g.restore();
}

const ANIMALS = { owl: "#b89a7a", fox: "#e8843a", hedgehog: "#8a6a55", turtle: "#5fa86a", rabbit: "#f1ebe2" };
function animal(g, s, x, y, u, awake, t) {
  const hop = awake ? Math.abs(Math.sin(t * 5 + s.id)) * u * 0.25 : 0;
  g.save();
  g.translate(x, y - hop);
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.beginPath();
  g.ellipse(0, hop + u * 0.05, u * 0.6, u * 0.18, 0, 0, TAU);
  g.fill();
  g.fillStyle = ANIMALS[s.kind];
  if (s.kind === "fox" || s.kind === "rabbit") {
    const tall = s.kind === "rabbit" ? 0.75 : 0.4;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(side * u * 0.36, -u * 0.6);
      g.lineTo(side * u * 0.26, -u * (0.75 + tall));
      g.lineTo(side * u * 0.08, -u * 0.7);
      g.fill();
    }
  }
  if (s.kind === "hedgehog") {
    g.fillStyle = "#5a4338";
    for (let k = 0; k < 9; k++) {
      const a = Math.PI + (k / 8) * Math.PI;
      g.beginPath();
      g.moveTo(Math.cos(a - 0.2) * u * 0.5, -u * 0.4 + Math.sin(a - 0.2) * u * 0.4);
      g.lineTo(Math.cos(a) * u * 0.78, -u * 0.4 + Math.sin(a) * u * 0.66);
      g.lineTo(Math.cos(a + 0.2) * u * 0.5, -u * 0.4 + Math.sin(a + 0.2) * u * 0.4);
      g.fill();
    }
    g.fillStyle = ANIMALS.hedgehog;
  }
  g.beginPath();
  g.ellipse(0, -u * 0.42, u * 0.52, u * 0.44, 0, 0, TAU);
  g.fill();
  if (s.kind === "turtle") {
    g.fillStyle = "#3f7a4a";
    g.beginPath();
    g.ellipse(-u * 0.05, -u * 0.5, u * 0.42, u * 0.32, 0, Math.PI, TAU);
    g.fill();
  }
  g.strokeStyle = g.fillStyle = INK;
  g.lineWidth = Math.max(1.5, u * 0.06);
  for (const side of [-1, 1]) {
    g.beginPath();
    if (awake) g.arc(side * u * 0.18, -u * 0.5, u * (s.kind === "owl" ? 0.13 : 0.075), 0, TAU), g.fill();
    else g.arc(side * u * 0.18, -u * 0.52, u * 0.09, 0.15, Math.PI - 0.15), g.stroke();
  }
  if (!awake) {
    g.font = `${u * 0.5}px Caprasimo, serif`;
    g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + s.id);
    g.fillStyle = "#ffffff";
    g.fillText("z", u * 0.5, -u * (1 + 0.15 * Math.sin(t * 2)));
  }
  g.restore();
}

function thing(g, d, x, y, u, world) {
  const s = u * d.size;
  g.save();
  g.translate(x, y);
  switch (d.kind) {
    case "tree":
    case "acacia":
      g.fillStyle = "#5a3d2e";
      g.fillRect(-s * 0.09, -s * 0.9, s * 0.18, s * 0.9);
      g.fillStyle = d.tint > 0.5 ? "#2f7a4f" : "#3a8a55";
      g.beginPath();
      if (d.kind === "acacia") g.ellipse(0, -s * 1.05, s * 0.95, s * 0.3, 0, 0, TAU);
      else {
        g.arc(0, -s * 1.3, s * 0.5, 0, TAU);
        g.moveTo(0, -s);
        g.arc(-s * 0.32, -s, s * 0.36, 0, TAU);
        g.moveTo(s * 0.68, -s);
        g.arc(s * 0.32, -s, s * 0.36, 0, TAU);
      }
      g.fill();
      break;
    case "bush":
      g.fillStyle = world.shade;
      g.beginPath();
      g.arc(-s * 0.2, -s * 0.22, s * 0.28, 0, TAU);
      g.moveTo(s * 0.5, -s * 0.26);
      g.arc(s * 0.18, -s * 0.26, s * 0.32, 0, TAU);
      g.fill();
      break;
    case "flower":
      g.strokeStyle = "#3a7a4a";
      g.lineWidth = s * 0.05;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -s * 0.4);
      g.stroke();
      g.fillStyle = ["#ffd9ec", "#fff0a8", "#c9e2ff"][Math.floor(d.tint * 3)];
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.arc(Math.cos((k / 5) * TAU) * s * 0.1, -s * 0.42 + Math.sin((k / 5) * TAU) * s * 0.1, s * 0.08, 0, TAU);
        g.fill();
      }
      break;
    case "reed":
      g.strokeStyle = d.tint > 0.5 ? "#c9b56a" : "#8fae6a";
      g.lineWidth = s * 0.05;
      g.lineCap = "round";
      for (const k of [-1, 0, 1]) {
        g.beginPath();
        g.moveTo(k * s * 0.08, 0);
        g.quadraticCurveTo(k * s * 0.12, -s * 0.4, k * s * 0.28, -s * (0.6 + 0.15 * (k + 1)));
        g.stroke();
      }
      break;
    case "rock":
    case "ember":
      g.fillStyle = d.kind === "ember" ? "#7a2a22" : "#6a6470";
      g.beginPath();
      g.moveTo(-s * 0.4, 0);
      g.lineTo(-s * 0.3, -s * 0.34);
      g.lineTo(s * 0.1, -s * 0.46);
      g.lineTo(s * 0.42, -s * 0.2);
      g.lineTo(s * 0.4, 0);
      g.fill();
      break;
    case "spire":
      g.fillStyle = "#5a5560";
      g.beginPath();
      g.moveTo(-s * 0.28, 0);
      g.lineTo(-s * 0.06, -s * 1.5);
      g.lineTo(s * 0.3, 0);
      g.fill();
      break;
    case "pillar":
      g.fillStyle = "#b8a488";
      g.fillRect(-s * 0.16, -s * 1.1, s * 0.32, s * 1.1);
      g.fillRect(-s * 0.24, -s * 1.2, s * 0.48, s * 0.14);
      break;
    case "crystal":
      g.fillStyle = world.fire;
      g.globalAlpha = 0.75;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-s * 0.2, -s * 0.5);
      g.lineTo(0, -s * 0.95);
      g.lineTo(s * 0.22, -s * 0.45);
      g.fill();
      break;
  }
  g.restore();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext("2d", { alpha: false });
    this.dark = document.createElement("canvas");
    this.dg = this.dark.getContext("2d");
    this.view = { w: 1, h: 1, dpr: 1, zoom: 1 };
    this.cam = null;
    this.reset();
  }
  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, w * h > 1.4e6 ? 1.25 : 2);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dark.width = Math.ceil(w / 2);
    this.dark.height = Math.ceil(h / 2);
    this.view = { w, h, dpr, zoom: clamp(Math.min(w, h) / 600, 0.6, 1.5) };
  }
  reset() {
    this.t = 0;
    this.cam = null;
    this.trail = [];
    this.litAt = new Map();
    this.wokeAt = new Map();
    this.sparks = [];
    this.words = [];
    this.rings = [];
    this.dawn = 0;
  }
  /** Tell the renderer what just happened so it can show it. */
  note(e, reduced) {
    const burst = (x, y, n, color) => {
      for (let k = 0; k < (reduced ? 3 : n) && this.sparks.length < 260; k++) {
        const a = Math.random() * TAU,
          v = 40 + Math.random() * 160;
        this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.5 + Math.random() * 0.6, color });
      }
    };
    if (e.type === "light") {
      this.litAt.set(e.id, this.t);
      burst(e.x, e.y - 40, 22, "#ffe9a8");
      this.words.push({ x: e.x, y: e.y - 90, text: `+${e.pts}`, life: 1.3 });
    } else if (e.type === "wake") {
      this.wokeAt.set(e.id, this.t);
      burst(e.x, e.y - 20, 12, "#ffffff");
      this.words.push({ x: e.x, y: e.y - 60, text: `+${e.pts}`, life: 1.3 });
    } else if (e.type === "gather") burst(e.x, e.y, 4, "#f4ffb0");
    else if (e.type === "roar") this.rings.push({ x: e.x, y: e.y, r: e.r, age: 0 });
    else if (e.type === "scatter") burst(e.x, e.y - 20, 16, "#f4ffb0");
    else if (e.type === "open") burst(e.x, e.y - 50, 30, "#ffffff");
  }

  draw(visit, dt, { reduced = false, lang = "en" } = {}) {
    const g = this.g,
      { w, h, dpr, zoom } = this.view,
      world = visit.world,
      look = visit.form.look;
    this.t += dt;
    const t = this.t;
    // camera
    const half = { x: w / 2 / zoom, y: h / 2 / zoom },
      aim = {
        x: world.w <= half.x * 2 - 120 ? world.w / 2 : clamp(visit.x, half.x - 60, world.w - half.x + 60),
        y: world.h <= half.y * 2 - 120 ? world.h / 2 : clamp(visit.y - 30, half.y - 60, world.h - half.y + 60),
      };
    this.cam ??= { ...aim };
    const follow = reduced ? 1 : Math.min(1, dt * 5);
    this.cam.x += (aim.x - this.cam.x) * follow;
    this.cam.y += (aim.y - this.cam.y) * follow;
    const X = (x) => (x - this.cam.x) * zoom + w / 2,
      Y = (y) => (y - this.cam.y) * zoom + h / 2,
      seen = (p, pad = 160) => X(p.x) > -pad && X(p.x) < w + pad && Y(p.y) > -pad && Y(p.y) < h + pad * 2;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = world.night;
    g.fillRect(0, 0, w, h);
    // ground
    // a darker border of thicket, then the ground itself
    g.fillStyle = world.shade;
    g.fillRect(X(-400), Y(-400), (world.w + 800) * zoom, (world.h + 800) * zoom);
    g.fillStyle = world.ground;
    g.beginPath();
    g.roundRect(X(0), Y(0), world.w * zoom, world.h * zoom, 90 * zoom);
    g.fill();
    g.fillStyle = world.shade;
    const cell = 110;
    for (let cy = Math.max(0, Math.floor((this.cam.y - half.y) / cell)); cy <= Math.min(Math.ceil(world.h / cell) - 1, Math.floor((this.cam.y + half.y) / cell)); cy++)
      for (let cx = Math.max(0, Math.floor((this.cam.x - half.x) / cell)); cx <= Math.min(Math.ceil(world.w / cell) - 1, Math.floor((this.cam.x + half.x) / cell)); cx++) {
        const a = hash(cx + world.index * 31, cy),
          b = hash(cy + 7, cx + world.index * 13);
        g.beginPath();
        g.ellipse(X(cx * cell + a * cell), Y(cy * cell + b * cell), (10 + a * 22) * zoom, (4 + b * 7) * zoom, 0, 0, TAU);
        g.fill();
      }
    for (const p of world.ponds) {
      if (!seen(p, p.r * zoom + 20)) continue;
      g.fillStyle = world.water;
      g.beginPath();
      g.arc(X(p.x), Y(p.y), p.r * zoom, 0, TAU);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.22)";
      g.lineWidth = 3 * zoom;
      for (const k of [0.45, 0.72]) {
        g.beginPath();
        g.arc(X(p.x), Y(p.y), p.r * k * zoom, t * 0.3 + k * 9, t * 0.3 + k * 9 + 1.6);
        g.stroke();
      }
    }
    // everything standing on the ground, back to front
    const items = [];
    for (const d of world.decor) if (seen(d)) items.push({ y: d.y, draw: () => thing(g, d, X(d.x), Y(d.y), 70 * zoom, world) });
    world.rocks.forEach((o, i) => {
      if (!seen(o, o.r * zoom + 40)) return;
      items.push({
        y: o.y + o.r * 0.6,
        draw: () => {
          g.fillStyle = "#57525f";
          g.beginPath();
          for (let k = 0; k < 9; k++) {
            const a = (k / 9) * TAU,
              r = o.r * (0.9 + 0.16 * hash(i * 9 + k, world.index)) * zoom;
            g.lineTo(X(o.x) + Math.cos(a) * r, Y(o.y) + Math.sin(a) * r * 0.9 - o.r * 0.12 * zoom);
          }
          g.fill();
          g.fillStyle = "#6f6978";
          g.beginPath();
          g.ellipse(X(o.x) - o.r * 0.15 * zoom, Y(o.y) - o.r * 0.38 * zoom, o.r * 0.55 * zoom, o.r * 0.34 * zoom, -0.2, 0, TAU);
          g.fill();
        },
      });
    });
    // anything that stands in water gets a lily pad to stand on
    const pad = (p, x, y, u) => {
      if (!world.ponds.some((o) => Math.hypot(p.x - o.x, p.y - o.y) < o.r)) return;
      g.fillStyle = "#4f9a5a";
      g.beginPath();
      g.ellipse(x, y, u * 1.2, u * 0.5, 0, 0.25, TAU - 0.1);
      g.lineTo(x, y);
      g.fill();
    };
    for (const l of world.lanterns) {
      if (!seen(l)) continue;
      const lit = visit.lit.has(l.id),
        pop = lit ? clamp((t - (this.litAt.get(l.id) ?? -9)) * 3, 0, 1) : 0;
      items.push({
        y: l.y,
        draw: () => {
          const x = X(l.x),
            y = Y(l.y),
            u = 30 * zoom;
          pad(l, x, y, u);
          g.fillStyle = "rgba(0,0,0,0.25)";
          g.beginPath();
          g.ellipse(x, y, u * 0.7, u * 0.2, 0, 0, TAU);
          g.fill();
          g.fillStyle = "#3a2f3f";
          g.fillRect(x - u * 0.12, y - u * 1.5, u * 0.24, u * 1.5);
          g.fillRect(x - u * 0.4, y - u * 0.12, u * 0.8, u * 0.14);
          g.fillStyle = lit ? "#fff3c4" : "#544a5a";
          g.beginPath();
          g.roundRect(x - u * 0.42, y - u * 2.5, u * 0.84, u * 1.05, u * 0.16);
          g.fill();
          g.fillStyle = "#3a2f3f";
          g.beginPath();
          g.moveTo(x - u * 0.56, y - u * 2.45);
          g.lineTo(x, y - u * 3);
          g.lineTo(x + u * 0.56, y - u * 2.45);
          g.fill();
          if (lit) flame(g, x, y - u * 1.72, u * (0.3 + 0.1 * (1 - pop) * 3 * pop + 0.04), { colors: ["#fff", world.fire, world.fire], tongues: 3, height: 1 }, t + l.id, undefined, reduced);
        },
      });
    }
    for (const s of world.sleepers)
      if (seen(s))
        items.push({
          y: s.y,
          draw: () => {
            pad(s, X(s.x), Y(s.y), 34 * zoom);
            animal(g, s, X(s.x), Y(s.y), 34 * zoom, visit.woken.has(s.id), reduced ? 0 : t);
          },
        });
    const open = visit.status !== "walking";
    if (seen(world.gate, 240))
      items.push({
        y: world.gate.y,
        draw: () => {
          const x = X(world.gate.x),
            y = Y(world.gate.y),
            u = 46 * zoom;
          if (open) {
            const glow = g.createLinearGradient(0, y - u * 2.6, 0, y);
            glow.addColorStop(0, "#ffffff");
            glow.addColorStop(1, world.fire);
            g.fillStyle = glow;
          } else g.fillStyle = "#1c1524";
          g.beginPath();
          g.moveTo(x - u * 0.9, y);
          g.lineTo(x - u * 0.9, y - u * 1.7);
          g.arc(x, y - u * 1.7, u * 0.9, Math.PI, 0);
          g.lineTo(x + u * 0.9, y);
          g.fill();
          g.strokeStyle = "#8a7f92";
          g.lineWidth = u * 0.42;
          g.lineCap = "butt";
          g.beginPath();
          g.moveTo(x - u * 1.05, y);
          g.lineTo(x - u * 1.05, y - u * 1.7);
          g.arc(x, y - u * 1.7, u * 1.05, Math.PI, 0);
          g.lineTo(x + u * 1.05, y);
          g.stroke();
        },
      });
    const lean = (() => {
      const to = visit.target();
      if (!to) return { x: 0, y: 0 };
      const d = Math.hypot(to.x - visit.x, to.y - visit.y) || 1;
      return { x: (to.x - visit.x) / d, y: (to.y - visit.y) / d };
    })();
    items.push({
      y: visit.y,
      draw: () => cub(g, X(visit.x), Y(visit.y), 30 * zoom, { facing: visit.facing, stride: visit.walked * 0.07, look, t, lean, hover: visit.overWater ? 1 : 0, calm: reduced }),
    });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // --- the dark, with holes ---
    this.dawn += ((open ? 1 : 0) - this.dawn) * Math.min(1, dt * 0.8);
    const d = this.dg,
      k = 0.5;
    d.globalCompositeOperation = "source-over";
    d.clearRect(0, 0, this.dark.width, this.dark.height);
    d.globalAlpha = 0.95 - this.dawn * 0.5;
    d.fillStyle = world.night;
    d.fillRect(0, 0, this.dark.width, this.dark.height);
    d.globalAlpha = 1;
    d.globalCompositeOperation = "destination-out";
    const hole = (x, y, r, strength = 1) => {
      if (x < -r || y < -r || x > w + r || y > h + r) return;
      const gr = d.createRadialGradient(x * k, y * k, r * k * 0.15, x * k, y * k, r * k);
      gr.addColorStop(0, `rgba(0,0,0,${strength})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      d.fillStyle = gr;
      d.fillRect((x - r) * k, (y - r) * k, r * 2 * k, r * 2 * k);
    };
    const flicker = reduced ? 1 : 1 + 0.03 * Math.sin(t * 11) + 0.02 * Math.sin(t * 23);
    hole(X(visit.x), Y(visit.y) - 20 * zoom, visit.light * zoom * flicker * 1.25);
    for (const l of world.lanterns)
      if (visit.lit.has(l.id)) hole(X(l.x), Y(l.y) - 50 * zoom, 300 * zoom * clamp((t - (this.litAt.get(l.id) ?? -9)) * 1.6, 0.2, 1) * flicker, 0.95);
    if (open) hole(X(world.gate.x), Y(world.gate.y) - 60 * zoom, 260 * zoom, 0.9);
    for (const s of world.sleepers) if (visit.woken.has(s.id)) hole(X(s.x), Y(s.y), 110 * zoom, 0.7);
    for (const r of this.rings) hole(X(r.x), Y(r.y), r.r * zoom * Math.min(1, r.age * 2.4) * 1.1, 0.8 * (1 - r.age));
    g.drawImage(this.dark, 0, 0, w, h);

    // --- things that glow on top of the dark ---
    g.globalCompositeOperation = "lighter";
    const glow = (x, y, r, color, a = 1) => {
      if (x < -r || y < -r || x > w + r || y > h + r) return;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, color);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = a;
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
      g.globalAlpha = 1;
    };
    glow(X(visit.x), Y(visit.y) - 38 * zoom, 90 * zoom * flicker, look.colors[1], 0.35);
    for (const l of world.lanterns) {
      const x = X(l.x),
        y = Y(l.y) - 52 * zoom;
      if (visit.lit.has(l.id)) glow(x, y, 70 * zoom * flicker, world.fire, 0.5);
      else {
        // a sleeping lantern glints now and then, so the dark is never hopeless
        const beat = (t * 0.28 + l.id * 0.37) % 1,
          a = beat < 0.12 ? Math.sin((beat / 0.12) * Math.PI) : 0;
        if (a > 0.02) glow(x, y, 16 * zoom, "#ffffff", a * 0.8);
      }
    }
    // fireflies: those at home, and those following him in a line
    this.trail.unshift({ x: visit.x, y: visit.y });
    this.trail.length = Math.min(this.trail.length, 420);
    for (const f of world.fireflies) {
      const idx = visit.with.indexOf(f.id);
      let x, y;
      if (idx >= 0) {
        const p = this.trail[Math.min(this.trail.length - 1, 10 + idx * 7)];
        x = p.x + Math.sin(t * 3 + f.phase) * 12;
        y = p.y - 34 + Math.cos(t * 2.3 + f.phase) * 12;
      } else {
        x = f.x + Math.sin(t * 0.9 + f.phase) * 16;
        y = f.y + Math.cos(t * 1.3 + f.phase * 2) * 12 - 12;
      }
      const tw = reduced ? 0.9 : 0.6 + 0.4 * Math.sin(t * 4 + f.phase * 3);
      glow(X(x), Y(y), 13 * zoom, "#f4ffb0", (visit.away.has(f.id) ? 0.35 : 1) * tw);
      glow(X(x), Y(y), 4 * zoom, "#ffffff", tw);
    }
    for (const r of this.rings) {
      r.age += dt * 1.6;
      g.globalAlpha = Math.max(0, 1 - r.age);
      g.strokeStyle = look.colors[1];
      g.lineWidth = 10 * zoom * (1 - r.age * 0.6);
      g.beginPath();
      g.arc(X(r.x), Y(r.y), Math.max(1, r.r * zoom * Math.min(1, r.age * 1.6)), 0, TAU);
      g.stroke();
    }
    this.rings = this.rings.filter((r) => r.age < 1);
    for (const s of this.sparks) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy -= 30 * dt;
      g.globalAlpha = clamp(s.life * 2, 0, 1);
      g.fillStyle = s.color;
      g.fillRect(X(s.x) - 2 * zoom, Y(s.y) - 2 * zoom, 4 * zoom, 4 * zoom);
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    // wind: pale curls you can see coming even in the dark
    for (const gu of world.gusts) {
      const at = visit.gustAt(gu),
        still = visit.calm.has(gu.id);
      if (!seen(at, 140)) continue;
      g.strokeStyle = `rgba(220,235,255,${still ? 0.12 : visit.form.guard ? 0.22 : 0.45})`;
      g.lineWidth = 4 * zoom;
      g.lineCap = "round";
      for (let c = 0; c < 4; c++) {
        const a = (still || reduced ? 0 : t * 2.6) + (c / 4) * TAU,
          r = gu.r * (0.35 + 0.18 * c) * zoom;
        g.beginPath();
        g.arc(X(at.x), Y(at.y), r, a, a + 1.9);
        g.stroke();
      }
    }
    g.font = `${Math.round(30 * clamp(zoom, 0.8, 1.2))}px Caprasimo, Georgia, serif`;
    g.textAlign = "center";
    for (const q of this.words) {
      q.life -= dt;
      q.y -= 34 * dt;
      g.globalAlpha = clamp(q.life * 2, 0, 1);
      g.lineWidth = 5;
      g.strokeStyle = "#1a0f1f";
      g.strokeText(q.text, X(q.x), Y(q.y));
      g.fillStyle = "#ffe9a8";
      g.fillText(q.text, X(q.x), Y(q.y));
    }
    g.globalAlpha = 1;
    this.words = this.words.filter((q) => q.life > 0);
  }
}

/** Leo in one of his forms on a dark card, for the form book and the end of each place. */
export function portrait(canvas, index, t, known = true) {
  const g = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height,
    look = FORMS[index].look;
  g.clearRect(0, 0, w, h);
  const bg = g.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, w * 0.7);
  bg.addColorStop(0, known ? look.colors[2] : "#2a2233");
  bg.addColorStop(0.5, "#1a1024");
  bg.addColorStop(1, "#0d0714");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (known) cub(g, w * 0.44, h * 0.86, w * 0.3, { look, t, facing: 1, stride: 0.6 });
  else {
    g.fillStyle = "rgba(255,255,255,0.14)";
    g.font = `${w * 0.5}px Caprasimo, Georgia, serif`;
    g.textAlign = "center";
    g.fillText("?", w / 2, h * 0.68);
  }
}
Renderer.prototype.screenOf = function (p) {
  const { w, h, zoom } = this.view,
    cam = this.cam ?? p;
  return { x: (p.x - cam.x) * zoom + w / 2, y: (p.y - cam.y) * zoom + h / 2 };
};
Renderer.prototype.worldOf = function (sx, sy) {
  const { w, h, zoom } = this.view,
    cam = this.cam ?? { x: 0, y: 0 };
  return { x: (sx - w / 2) / zoom + cam.x, y: (sy - h / 2) / zoom + cam.y };
};
