// Everything on screen is drawn by code: nebulae from layered noise, rocks
// from seeded polygons, light from additive sprites. No image downloads.
import { clamp, lerp, rng, TAU } from "../../../js/fable/kit.js?v=1";
import { H, GRAZE, PLAYER_R } from "./engine.js?v=1";

const DANGER = "#ff6a4d"; // warm things hurt
const SELF = "#b9a8ff"; // cool things are you
const DUST = "#ffe6a3";
const AEGIS = "#7dffc8";

// deep, mid, glow per sector
export const PALETTES = [
  ["#05071a", "#18276a", "#4a86e0"],
  ["#04101c", "#0e4560", "#86dcec"],
  ["#120508", "#56181c", "#e8703a"],
  ["#090516", "#38196a", "#b874e8"],
  ["#030f0d", "#0e4638", "#62dca6"],
  ["#0c0b0a", "#4a4230", "#f4e6b8"],
];

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function glowSprite(color, size = 128) {
  const c = canvasOf(size, size),
    g = c.getContext("2d"),
    [r, gg, b] = hex(color),
    grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${r},${gg},${b},0.9)`);
  grad.addColorStop(0.25, `rgba(${r},${gg},${b},0.35)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}
function rockSprite(seed) {
  const S = 220,
    R = 92,
    c = canvasOf(S, S),
    g = c.getContext("2d"),
    rand = rng(seed * 977 + 13),
    n = 10 + Math.floor(rand() * 4),
    pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (rand() - 0.5) * 0.3,
      r = R * (0.74 + rand() * 0.26);
    pts.push([S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r]);
  }
  const path = () => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };
  path();
  const body = g.createRadialGradient(S * 0.36, S * 0.32, 6, S / 2, S / 2, R * 1.1);
  body.addColorStop(0, "#857c8c");
  body.addColorStop(0.5, "#423c4a");
  body.addColorStop(1, "#1d1a22");
  g.fillStyle = body;
  g.fill();
  g.save();
  g.clip();
  for (let i = 0; i < 6; i++) {
    const a = rand() * TAU,
      d = rand() * R * 0.62,
      x = S / 2 + Math.cos(a) * d,
      y = S / 2 + Math.sin(a) * d,
      r = 7 + rand() * 17;
    g.fillStyle = "rgba(8,7,12,0.55)";
    g.beginPath();
    g.ellipse(x, y, r, r * 0.82, a, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(190,180,200,0.22)";
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(x + 1.5, y + 1.5, r, r * 0.82, a, 0.3, 2.2);
    g.stroke();
  }
  // facets: a few straight shadows give the rock some weight
  g.strokeStyle = "rgba(0,0,0,0.28)";
  g.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const [x1, y1] = pts[Math.floor(rand() * n)];
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(S / 2 + (rand() - 0.5) * 50, S / 2 + (rand() - 0.5) * 50);
    g.stroke();
  }
  g.restore();
  path();
  g.strokeStyle = DANGER;
  g.lineWidth = 5;
  g.lineJoin = "round";
  g.globalAlpha = 0.92;
  g.stroke();
  return c;
}
function nebulaCanvas(palette, seed) {
  const W = 256,
    HH = 176,
    c = canvasOf(W, HH),
    g = c.getContext("2d"),
    img = g.createImageData(W, HH),
    rand = rng(seed),
    G = 32,
    grid = new Float32Array((G + 1) * (G + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const vn = (x, y) => {
    const xi = Math.floor(x) % G,
      yi = Math.floor(y) % G,
      fx = x - Math.floor(x),
      fy = y - Math.floor(y),
      sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy),
      a = grid[yi * (G + 1) + xi],
      b = grid[yi * (G + 1) + ((xi + 1) % G)],
      d = grid[((yi + 1) % G) * (G + 1) + xi],
      e = grid[((yi + 1) % G) * (G + 1) + ((xi + 1) % G)];
    return a + (b - a) * sx + (d - a) * sy + (a - b - d + e) * sx * sy;
  };
  const fbm = (x, y) => vn(x, y) * 0.5 + vn(x * 2.03, y * 2.03) * 0.27 + vn(x * 4.1, y * 4.1) * 0.15 + vn(x * 8.3, y * 8.3) * 0.08;
  const [d, m, gl] = palette.map(hex);
  for (let y = 0; y < HH; y++)
    for (let x = 0; x < W; x++) {
      const u = x / 46,
        v = y / 46,
        warp = fbm(u + 9.1, v + 3.3) * 2.4,
        a = fbm(u + warp, v + warp * 0.7),
        b = fbm(u * 0.6 + 17, v * 0.6 + 5),
        cloud = clamp((a - 0.36) * 2.4, 0, 1) ** 1.5,
        hot = clamp((a * b - 0.22) * 4.5, 0, 1) ** 2.2,
        i = (y * W + x) * 4;
      for (let k = 0; k < 3; k++)
        img.data[i + k] = clamp(lerp(d[k], m[k], cloud) + gl[k] * hot * 0.62, 0, 255);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return c;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.rocks = Array.from({ length: 8 }, (_, i) => rockSprite(i + 1));
    this.glow = {
      danger: glowSprite(DANGER),
      self: glowSprite(SELF),
      dust: glowSprite(DUST),
      aegis: glowSprite(AEGIS),
      white: glowSprite("#ffffff"),
    };
    this.nebulae = new Map();
    const rand = rng(4242);
    this.stars = Array.from({ length: 170 }, (_, i) => ({
      x: rand(),
      y: rand(),
      layer: i % 3,
      size: 0.6 + rand() * 1.5,
      alpha: 0.25 + rand() * 0.7,
      phase: rand() * TAU,
    }));
    this.particles = [];
    this.texts = [];
    this.rings = [];
    this.trail = [];
    this.shake = 0;
    this.flash = 0;
    this.sector = 0;
    this.prevSector = 0;
    this.sectorFade = 1;
    this.t = 0;
    this.flowSeen = 0;
    this.css = { w: 1, h: 1 };
    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    this.font = "Unbounded, system-ui, sans-serif";
  }
  nebula(i) {
    const k = ((i % PALETTES.length) + PALETTES.length) % PALETTES.length;
    if (!this.nebulae.has(k)) this.nebulae.set(k, nebulaCanvas(PALETTES[k], 100 + k * 31));
    return this.nebulae.get(k);
  }
  resize(w, h, fieldW) {
    const dpr = Math.min(window.devicePixelRatio || 1, w * h > 1.6e6 ? 1.5 : 2);
    this.dpr = dpr;
    this.css = { w, h };
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = Math.min(w / fieldW, h / H);
    this.ox = (w - fieldW * this.scale) / 2;
    this.oy = (h - H * this.scale) / 2;
    this.fieldW = fieldW;
  }
  /** Screen (CSS px, canvas-relative) to field units. */
  toField(x, y) {
    return { x: (x - this.ox) / this.scale, y: (y - this.oy) / this.scale };
  }
  reset(sector = 0) {
    this.particles.length = this.texts.length = this.rings.length = this.trail.length = 0;
    this.shake = this.flash = 0;
    this.sector = this.prevSector = sector;
    this.sectorFade = 1;
  }
  burst(x, y, n, { color = DANGER, speed = 260, life = 0.6, size = 3, spread = TAU, dir = 0, line = true } = {}) {
    if (this.reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n && this.particles.length < 520; i++) {
      const a = dir + (Math.random() - 0.5) * spread,
        v = speed * (0.3 + Math.random() * 0.9);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.5 + Math.random() * 0.7), max: life, color, size: size * (0.5 + Math.random()), line });
    }
  }
  text(x, y, text, color = "#fff", size = 22, life = 0.8) {
    if (this.texts.length < 24) this.texts.push({ x, y, text, color, size, life, max: life });
  }
  ring(x, y, color, to = 300, life = 0.6, width = 6) {
    this.rings.push({ x, y, color, to, life, max: life, width });
  }
  handle(e, run) {
    const p = run.player;
    switch (e.type) {
      case "graze":
        this.burst(e.x, e.y, 5 + Math.round(e.closeness * 7), { color: e.closeness > 0.7 ? "#ffffff" : SELF, speed: 420, life: 0.35, size: 2.4 });
        if (e.chain % 3 === 0 || e.closeness > 0.85) this.text(e.x, e.y - 26, `+${e.pts}`, SELF, 17, 0.6);
        break;
      case "multiplier":
        this.text(p.x, p.y - 62, `×${e.value}`, e.value >= 8 ? DUST : "#ffffff", e.value >= 8 ? 40 : 30, 1);
        this.ring(p.x, p.y, e.value >= 8 ? DUST : SELF, 150, 0.45, 4);
        break;
      case "dust":
        this.burst(e.x, e.y, 8, { color: DUST, speed: 200, life: 0.4, size: 2.2 });
        break;
      case "aegis":
        this.ring(p.x, p.y, AEGIS, 130, 0.5, 5);
        this.text(p.x, p.y - 62, "Shield up", AEGIS, 20, 1);
        break;
      case "shatter":
        this.burst(e.x, e.y, e.kind === "bar" ? 26 : 14, { color: DANGER, speed: 520, life: 0.7, size: 4, line: false });
        break;
      case "split":
        this.ring(e.x, e.y, DANGER, e.r * 2.4, 0.35, 5);
        this.burst(e.x, e.y, 16, { color: "#ffb38a", speed: 380, life: 0.5, size: 3 });
        break;
      case "shield":
        this.ring(e.x, e.y, AEGIS, 330, 0.55, 12);
        this.ring(e.x, e.y, "#ffffff", 240, 0.35, 4);
        this.burst(e.x, e.y, 40, { color: AEGIS, speed: 640, life: 0.7, size: 3 });
        this.shake = 18;
        this.flash = 0.5;
        this.text(e.x, e.y - 70, "Shield lost", AEGIS, 20, 1.1);
        break;
      case "over":
        this.ring(e.x, e.y, "#ffffff", 520, 0.9, 10);
        this.ring(e.x, e.y, SELF, 300, 0.7, 20);
        this.burst(e.x, e.y, 90, { color: SELF, speed: 760, life: 1.3, size: 4 });
        this.burst(e.x, e.y, 50, { color: "#ffffff", speed: 420, life: 1, size: 3, line: false });
        this.shake = 30;
        this.flash = 0.85;
        break;
      case "warpOn":
        this.ring(p.x, p.y, SELF, 900, 0.7, 3);
        break;
    }
  }

  draw(run, dt, { reduced = false, dim = 0 } = {}) {
    const g = this.ctx,
      { w, h } = this.css,
      warp = run.warp,
      fdt = dt * (1 - 0.62 * warp);
    this.reduced = reduced;
    this.t += dt;
    this.sectorFade = Math.min(1, this.sectorFade + dt / 1.6);
    if (run.sector !== this.sector) {
      this.prevSector = this.sector;
      this.sector = run.sector;
      this.sectorFade = 0;
    }
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // --- deep space ----------------------------------------------------
    const drift = Math.sin(this.t * 0.05) * 0.03,
      bg = (canvas, alpha) => {
        g.globalAlpha = alpha;
        g.drawImage(canvas, -w * (0.06 + drift), -h * 0.06 - ((run.world * 4) % (h * 0.08)) + h * 0.04, w * 1.16, h * 1.2);
      };
    g.imageSmoothingQuality = "high";
    if (this.sectorFade < 1) bg(this.nebula(this.prevSector), 1);
    bg(this.nebula(this.sector), this.sectorFade);
    g.globalAlpha = 1;
    const fall = run.world;
    for (const s of this.stars) {
      const speed = [0.012, 0.03, 0.07][s.layer],
        y = ((s.y + fall * speed) % 1) * h,
        tw = reduced ? 1 : 0.75 + 0.25 * Math.sin(this.t * 2 + s.phase);
      g.globalAlpha = s.alpha * tw;
      g.fillStyle = s.layer === 2 ? "#ffffff" : "#c9d2ff";
      const len = s.size * (1 + s.layer * Math.min(3, 0.5 + run.level * 0.06) * (1 - warp * 0.8));
      g.fillRect(s.x * w, y, s.size, len);
    }
    g.globalAlpha = 1;

    // --- field ---------------------------------------------------------
    let sx = 0,
      sy = 0;
    if (this.shake > 0.3 && !reduced) {
      sx = (Math.random() - 0.5) * this.shake;
      sy = (Math.random() - 0.5) * this.shake;
    }
    this.shake *= Math.exp(-7 * dt);
    g.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * (this.ox + sx), this.dpr * (this.oy + sy));
    const W = run.width,
      p = run.player;
    if (this.ox > 4) {
      g.fillStyle = "rgba(0,0,0,0.42)";
      g.fillRect(-this.ox / this.scale - 2, -50, this.ox / this.scale + 2, H + 100);
      g.fillRect(W, -50, this.ox / this.scale + 2, H + 100);
    }

    // telegraphs
    for (const t of run.telegraphs) {
      const k = 1 - t.left / t.total,
        pulse = 0.5 + 0.5 * Math.sin(this.t * 26);
      g.globalAlpha = 0.16 + 0.34 * k + (reduced ? 0 : 0.1 * pulse);
      g.fillStyle = DANGER;
      if (t.kind === "lane") {
        const half = lerp(42, 13, k);
        g.fillRect(t.x - half, 0, half * 2, H);
        g.globalAlpha = 0.95;
        g.beginPath();
        g.moveTo(t.x - 15, 104);
        g.lineTo(t.x + 15, 104);
        g.lineTo(t.x, 128);
        g.fill();
      } else {
        const half = lerp(38, 14, k),
          ex = t.side > 0 ? 0 : W;
        g.fillRect(0, t.y - half, W, half * 2);
        g.globalAlpha = 0.95;
        g.beginPath();
        g.moveTo(ex, t.y - 17);
        g.lineTo(ex, t.y + 17);
        g.lineTo(ex + t.side * 26, t.y);
        g.fill();
      }
    }
    g.globalAlpha = 1;

    // pickups
    g.globalCompositeOperation = "lighter";
    for (const u of run.pickups) {
      const aeg = u.type === "aegis",
        r = aeg ? 62 : 34;
      g.globalAlpha = 0.75;
      g.drawImage(aeg ? this.glow.aegis : this.glow.dust, u.x - r, u.y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    for (const u of run.pickups) {
      g.save();
      g.translate(u.x, u.y);
      if (u.type === "aegis") {
        g.rotate(this.t * 1.2);
        g.strokeStyle = AEGIS;
        g.lineWidth = 3.5;
        g.beginPath();
        for (let i = 0; i < 6; i++) g.lineTo(Math.cos((i / 6) * TAU) * 15, Math.sin((i / 6) * TAU) * 15);
        g.closePath();
        g.stroke();
        g.fillStyle = "#eafff6";
        g.beginPath();
        g.arc(0, 0, 4.5, 0, TAU);
        g.fill();
      } else {
        g.rotate(this.t * 2 + u.x);
        g.fillStyle = "#fff6d6";
        g.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 ? 3.4 : 11;
          g.lineTo(Math.cos((i / 8) * TAU) * r, Math.sin((i / 8) * TAU) * r);
        }
        g.fill();
      }
      g.restore();
    }

    // hazard light, then hazard bodies
    g.globalCompositeOperation = "lighter";
    for (const hz of run.hazards) {
      if (hz.kind === "bar") continue;
      const r = hz.r * (hz.kind === "comet" ? 4.2 : 2.3);
      g.globalAlpha = hz.kind === "comet" ? 0.9 : 0.55;
      g.drawImage(this.glow.danger, hz.x - r, hz.y - r, r * 2, r * 2);
      if (warp > 0.05 && !reduced) {
        // slow light: a faint echo of where the rock was heading from
        g.globalAlpha = 0.16 * warp;
        g.drawImage(this.glow.danger, hz.x - hz.vx * 0.05 - r * 0.8, hz.y - hz.vy * 0.05 - r * 0.8, r * 1.6, r * 1.6);
      }
    }
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    for (const hz of run.hazards) {
      switch (hz.kind) {
        case "bar": {
          g.save();
          g.translate(hz.x, hz.y);
          g.rotate(hz.angle);
          const L = hz.half + hz.r,
            r = hz.r;
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = 0.22;
          g.strokeStyle = DANGER;
          g.lineWidth = r * 2 + 18;
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(-hz.half, 0);
          g.lineTo(hz.half, 0);
          g.stroke();
          g.globalCompositeOperation = "source-over";
          g.globalAlpha = 1;
          g.beginPath();
          g.roundRect(-L, -r, L * 2, r * 2, r);
          g.fillStyle = "#1c1a22";
          g.fill();
          g.strokeStyle = DANGER;
          g.lineWidth = 3;
          g.stroke();
          g.strokeStyle = "rgba(255,150,120,0.34)";
          g.lineWidth = 2;
          g.beginPath();
          for (let x = -hz.half + 8; x < hz.half - 4; x += 26) {
            g.moveTo(x, r - 5);
            g.lineTo(x + 12, -r + 5);
          }
          g.stroke();
          g.restore();
          break;
        }
        case "shard": {
          g.save();
          g.translate(hz.x, hz.y);
          g.rotate(Math.atan2(hz.vy, hz.vx));
          g.fillStyle = "#ffe3d6";
          g.strokeStyle = DANGER;
          g.lineWidth = 2.5;
          g.beginPath();
          g.moveTo(hz.r * 2, 0);
          g.lineTo(0, hz.r * 0.8);
          g.lineTo(-hz.r * 2.6, 0);
          g.lineTo(0, -hz.r * 0.8);
          g.closePath();
          g.fill();
          g.stroke();
          g.restore();
          break;
        }
        case "comet": {
          const tail = 240;
          const grad = g.createLinearGradient(hz.x, hz.y, hz.x, hz.y - tail);
          grad.addColorStop(0, "rgba(255,190,150,0.85)");
          grad.addColorStop(1, "rgba(255,106,77,0)");
          g.fillStyle = grad;
          g.beginPath();
          g.moveTo(hz.x - hz.r, hz.y);
          g.lineTo(hz.x + hz.r, hz.y);
          g.lineTo(hz.x, hz.y - tail);
          g.fill();
          g.fillStyle = "#fff4ea";
          g.beginPath();
          g.arc(hz.x, hz.y, hz.r, 0, TAU);
          g.fill();
          break;
        }
        default: {
          const sprite = this.rocks[hz.variant % this.rocks.length],
            d = hz.r * 2.39; // sprite radius 92 inside a 220 px tile
          g.save();
          g.translate(hz.x, hz.y);
          g.rotate(hz.angle);
          g.drawImage(sprite, -d / 2, -d / 2, d, d);
          if (hz.kind === "splitter") {
            const near = clamp(1 - (hz.splitY - hz.y) / 260, 0, 1),
              beat = reduced ? 1 : 0.6 + 0.4 * Math.sin(this.t * (8 + near * 22));
            g.globalAlpha = (0.35 + 0.65 * near) * beat;
            g.strokeStyle = "#ffc49a";
            g.lineWidth = 3.5;
            g.beginPath();
            for (let i = 0; i < 3; i++) {
              const a = (i / 3) * TAU + 0.5;
              g.moveTo(0, 0);
              g.lineTo(Math.cos(a) * hz.r * 0.5, Math.sin(a) * hz.r * 0.5);
              g.lineTo(Math.cos(a + 0.35) * hz.r * 0.86, Math.sin(a + 0.35) * hz.r * 0.86);
            }
            g.stroke();
          }
          g.restore();
        }
      }
    }
    g.globalAlpha = 1;

    // --- ship ----------------------------------------------------------
    const alive = run.status !== "over";
    if (alive) {
      this.trail.push({ x: p.x, y: p.y + 14 });
      if (this.trail.length > 20) this.trail.shift();
    } else this.trail.shift();
    for (const q of this.trail) q.y += 300 * fdt;
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    g.strokeStyle = SELF;
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1],
        b = this.trail[i],
        k = i / this.trail.length;
      g.globalAlpha = k * (0.3 + 0.5 * warp + 0.2 * (run.flow / 100));
      g.lineWidth = 2 + k * (7 + 6 * warp);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
    if (alive) {
      const gr = 70 + 26 * warp + (run.flow >= 100 ? 14 : 0);
      g.globalAlpha = 0.55 + 0.35 * warp;
      g.drawImage(run.flow >= 100 ? this.glow.dust : this.glow.self, p.x - gr, p.y - gr, gr * 2, gr * 2);
    }
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    if (alive) {
      const blink = run.invulnerable > 0 && Math.floor(this.t * 16) % 2 === 0;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.lean * 0.38);
      g.globalAlpha = blink ? 0.4 : 1;
      // engine
      const flame = 16 + Math.random() * 10 + Math.max(0, -p.vy) * 0.02;
      g.fillStyle = "#d9d0ff";
      g.beginPath();
      g.moveTo(-6, 15);
      g.lineTo(0, 15 + flame);
      g.lineTo(6, 15);
      g.fill();
      // hull
      g.fillStyle = "#f5f2ff";
      g.beginPath();
      g.moveTo(0, -27);
      g.lineTo(9, -2);
      g.lineTo(23, 15);
      g.lineTo(7, 12);
      g.lineTo(0, 18);
      g.lineTo(-7, 12);
      g.lineTo(-23, 15);
      g.lineTo(-9, -2);
      g.closePath();
      g.fill();
      g.fillStyle = "#6d58d8";
      g.beginPath();
      g.moveTo(0, -15);
      g.lineTo(4.5, 2);
      g.lineTo(0, 7);
      g.lineTo(-4.5, 2);
      g.closePath();
      g.fill();
      g.restore();
      if (run.shield) {
        g.strokeStyle = AEGIS;
        g.lineWidth = 2.5;
        g.globalAlpha = 0.85;
        g.setLineDash([18, 9]);
        g.lineDashOffset = -this.t * 40;
        g.beginPath();
        g.arc(p.x, p.y, 38, 0, TAU);
        g.stroke();
        g.setLineDash([]);
      }
      // flow gauge around the hull, visible when it matters
      this.flowSeen = Math.max(warp, this.flowSeen - dt * 1.5, run.flowIdle < 0.4 ? 0.7 : 0);
      if (this.flowSeen > 0.02 && run.status === "playing") {
        g.globalAlpha = this.flowSeen * 0.9;
        g.strokeStyle = "rgba(255,255,255,0.18)";
        g.lineWidth = 4;
        g.beginPath();
        g.arc(p.x, p.y, 50, 0, TAU);
        g.stroke();
        g.strokeStyle = run.flow >= 100 ? DUST : SELF;
        g.beginPath();
        g.arc(p.x, p.y, 50, -Math.PI / 2, -Math.PI / 2 + (run.flow / 100) * TAU);
        g.stroke();
      }
      if (warp > 0.05) {
        g.globalAlpha = warp * 0.3;
        g.strokeStyle = "#ffffff";
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(p.x, p.y, PLAYER_R + GRAZE + 18, 0, TAU);
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    // --- light effects -------------------------------------------------
    g.globalCompositeOperation = "lighter";
    for (const q of this.particles) {
      q.life -= fdt;
      q.x += q.vx * fdt;
      q.y += q.vy * fdt;
      q.vx *= 1 - 1.6 * fdt;
      q.vy *= 1 - 1.6 * fdt;
      const k = clamp(q.life / q.max, 0, 1);
      g.globalAlpha = k;
      if (q.line) {
        g.strokeStyle = q.color;
        g.lineWidth = q.size;
        g.beginPath();
        g.moveTo(q.x, q.y);
        g.lineTo(q.x - q.vx * 0.035, q.y - q.vy * 0.035);
        g.stroke();
      } else {
        g.fillStyle = q.color;
        g.fillRect(q.x - q.size, q.y - q.size, q.size * 2, q.size * 2);
      }
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    for (const r of this.rings) {
      r.life -= dt;
      const k = 1 - clamp(r.life / r.max, 0, 1);
      g.globalAlpha = (1 - k) * 0.8;
      g.strokeStyle = r.color;
      g.lineWidth = r.width * (1 - k * 0.7);
      g.beginPath();
      g.arc(r.x, r.y, r.to * (1 - (1 - k) ** 3), 0, TAU);
      g.stroke();
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    g.globalCompositeOperation = "source-over";
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const t of this.texts) {
      t.life -= dt;
      const k = clamp(t.life / t.max, 0, 1);
      g.globalAlpha = Math.min(1, k * 2.5);
      g.font = `700 ${t.size}px ${this.font}`;
      g.fillStyle = t.color;
      g.fillText(t.text, clamp(t.x, 60, W - 60), t.y - (1 - k) * 34);
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    g.globalAlpha = 1;

    // --- lens ----------------------------------------------------------
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (warp > 0.01) {
      g.fillStyle = `rgba(52,30,140,${0.26 * warp})`;
      g.fillRect(0, 0, w, h);
    }
    if (this.flash > 0.01 && !reduced) {
      g.fillStyle = `rgba(255,255,255,${this.flash * 0.7})`;
      g.fillRect(0, 0, w, h);
    }
    this.flash *= Math.exp(-9 * dt);
    if (dim > 0) {
      g.fillStyle = `rgba(4,5,16,${dim})`;
      g.fillRect(0, 0, w, h);
    }
  }
}
