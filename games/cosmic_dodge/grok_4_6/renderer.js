import { clamp } from "./engine.js";
const TAU = Math.PI * 2;
const polygon = (ctx, points, fill, stroke, width = 0.7) => {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
};
const PALETTE = {
  rock: ["#d8cbb8", "#8a7d6e", "#3c352c", "#16120e"],
  iron: ["#e8b48a", "#8a4a32", "#3a1c14", "#140806"],
  ice: ["#e8f0f6", "#8aa0b4", "#2a3848", "#0c1218"],
  cluster: ["#e8c878", "#8a6a32", "#3a2a14", "#161008"],
  shard: ["#dcc8a0", "#7a6850", "#32281c", "#120e0a"],
  meteor: ["#ffb080", "#c45a32", "#3a180c", "#140806"],
  shear: ["#ffe0a0", "#e07040", "#4a2010", "#160806"],
};
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.backdrop = new Image();
    this.backdrop.src = new URL("./void-gold.webp", import.meta.url).href;
    this.backdrop.onload = () => {
      this.background = null;
    };
    this.stars = Array.from({ length: 140 }, (_, i) => ({
      x: ((i * 73.37) % 100) / 100,
      y: ((i * 41.19) % 100) / 100,
      z: 0.2 + (i % 5) / 5,
      size: i % 9 === 0 ? 1.6 : 0.6,
    }));
    this.particles = [];
    this.rings = [];
    this.labels = [];
    this.trail = [];
    this.shake = 0;
    this.flash = 0;
    this.rockCache = new WeakMap();
    this.background = null;
    this.starScroll = 0;
  }
  resize(w, h, dpr) {
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.background = null;
    this.trail = [];
  }
  reset() {
    this.particles = [];
    this.rings = [];
    this.labels = [];
    this.trail = [];
    this.shake = 0;
    this.flash = 0;
  }
  burst(x, y, color, count = 20, force = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU,
        v = (35 + Math.random() * 200) * force;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.3 + Math.random() * 0.6,
        max: 1,
        color,
        size: 1 + Math.random() * 3,
      });
    }
    if (this.particles.length > 260)
      this.particles.splice(0, this.particles.length - 260);
  }
  event(e, reduced = false) {
    const count = reduced ? 7 : 23;
    if (e.type === "phase") {
      this.rings.push({ x: e.x, y: e.y, r: 15, life: 0.65, color: "#f0c878" });
      this.burst(e.x, e.y, "#f6dd9a", count, 1.6);
    }
    if (e.type === "shatter") {
      this.burst(e.x, e.y, e.kind === "iron" ? "#e07048" : "#e8c878", count, 1.3);
      this.rings.push({ x: e.x, y: e.y, r: 5, life: 0.25, color: "#f3e0b0" });
    }
    if (e.type === "hit") {
      this.burst(e.x, e.y, "#ff8a62", count * 2, 1.5);
      this.shake = reduced ? 0 : 9;
      this.flash = 0.5;
    }
    if (e.type === "star" || e.type === "repair") {
      const color = e.type === "repair" ? "#e4b45a" : "#f3ece0";
      this.burst(e.x, e.y, color, reduced ? 4 : 10, 0.5);
      this.labels.push({
        x: e.x,
        y: e.y,
        text: e.type === "repair" ? "SHIELD READY" : `+${e.points}`,
        color,
        life: 1,
      });
    }
    if (e.type === "near") {
      this.labels.push({
        x: e.x,
        y: e.y,
        text: `CLOSE CALL  +${e.points}`,
        color: "#f0c878",
        life: 1.1,
      });
      this.burst(e.x, e.y + 30, "#f6dd9a", reduced ? 3 : 9, 0.4);
    }
    if (e.type === "slingshot") {
      this.labels.push({
        x: e.x,
        y: e.y,
        text: `SLINGSHOT  +${e.points}`,
        color: "#f6dd9a",
        life: 1.3,
      });
      this.rings.push({ x: e.x, y: e.y, r: 10, life: 0.5, color: "#e4b45a" });
      this.burst(e.x, e.y, "#ffe7b0", reduced ? 8 : 28, 1.8);
    }
    if (e.type === "well") {
      this.rings.push({ x: e.x, y: e.y, r: 20, life: 0.8, color: "#e4b45a" });
    }
  }
  backdropLayer(f, time, reduced) {
    const c = this.ctx,
      w = this.w,
      h = this.h;
    if (!this.background) {
      this.background = document.createElement("canvas");
      this.background.width = Math.ceil(w);
      this.background.height = Math.ceil(h);
      const b = this.background.getContext("2d");
      b.fillStyle = "#08090d";
      b.fillRect(0, 0, w, h);
      if (this.backdrop.complete && this.backdrop.naturalWidth) {
        const size = Math.max(
          w / this.backdrop.width,
          h / this.backdrop.height,
        );
        const iw = this.backdrop.width * size,
          ih = this.backdrop.height * size;
        b.drawImage(this.backdrop, (w - iw) * 0.72, (h - ih) * 0.45, iw, ih);
      } else {
        const g = b.createRadialGradient(
          w * 0.72,
          h * 0.32,
          0,
          w * 0.6,
          h * 0.5,
          w * 0.75,
        );
        g.addColorStop(0, "#4a3820");
        g.addColorStop(0.45, "#1a140c");
        g.addColorStop(1, "#08090d");
        b.fillStyle = g;
        b.fillRect(0, 0, w, h);
      }
    }
    c.drawImage(this.background, 0, 0, w, h);
    const menu = f.status === "ready";
    c.fillStyle = menu ? "#08090d18" : "#08090d88";
    c.fillRect(0, 0, w, h);
    if (!menu && f.level > 1) {
      c.fillStyle = ["#3a241012", "#2a180c22", "#4a201018", "#24180c30"][
        Math.min(3, Math.floor((f.level - 1) / 10))
      ];
      c.fillRect(0, 0, w, h);
    }
    for (const star of this.stars) {
      const x = star.x * w,
        y = ((star.y * h + this.starScroll * star.z) % (h + 8)) - 4;
      c.globalAlpha = 0.22 + star.z * 0.55;
      c.fillStyle = star.z > 0.8 ? "#f3ece0" : "#c4b08a";
      const stretch =
        !menu && !reduced ? (f.phaseLeft ? 16 : 2 + Math.min(4, f.level)) : 1;
      c.fillRect(x, y, star.size, star.size * stretch);
    }
    c.globalAlpha = 1;
  }
  rock(rock) {
    let sprite = this.rockCache.get(rock);
    if (!sprite) {
      sprite = document.createElement("canvas");
      sprite.width = 128;
      sprite.height = 128;
      const c = sprite.getContext("2d");
      c.translate(64, 64);
      const edges = rock.shape?.length
        ? rock.shape
        : [0.8, 1, 0.88, 0.93, 0.8, 0.95, 0.83, 0.91, 0.86, 0.9];
      const points = edges.map((r, i) => [
        Math.cos((i / edges.length) * TAU) * r * 52,
        Math.sin((i / edges.length) * TAU) * r * 52,
      ]);
      const pal = PALETTE[rock.kind] || PALETTE.rock;
      const g = c.createLinearGradient(-40, -48, 32, 47);
      g.addColorStop(0, pal[0]);
      g.addColorStop(0.22, pal[1]);
      g.addColorStop(0.58, pal[2]);
      g.addColorStop(1, pal[3]);
      polygon(c, points, g, pal[0] + "99");
      c.save();
      c.clip();
      for (let i = 0; i < 7; i++) {
        const x = Math.sin(i * 31 + 2) * 34,
          y = Math.cos(i * 18) * 32,
          r = 7 + (i % 3) * 4;
        const crater = c.createRadialGradient(x + 2, y + 3, 1, x, y, r);
        crater.addColorStop(0, "#09080688");
        crater.addColorStop(0.7, pal[3] + "66");
        crater.addColorStop(1, pal[0] + "22");
        c.fillStyle = crater;
        c.beginPath();
        c.ellipse(x, y, r, r * 0.7, i, 0, TAU);
        c.fill();
      }
      if (rock.kind === "iron" || rock.kind === "cluster") {
        c.strokeStyle = "#f0c87855";
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(-30, -8);
        c.lineTo(8, -28);
        c.lineTo(22, 10);
        c.stroke();
      }
      c.restore();
      this.rockCache.set(rock, sprite);
    }
    const c = this.ctx;
    c.save();
    c.translate(rock.x, rock.y);
    if (rock.kind === "meteor") {
      const a = Math.atan2(rock.drift, rock.speed);
      c.rotate(-a);
      const g = c.createLinearGradient(0, 0, 0, -rock.radius * 8);
      g.addColorStop(0, "#ffb989b0");
      g.addColorStop(0.35, "#f977533f");
      g.addColorStop(1, "#ff683000");
      polygon(
        c,
        [
          [-rock.radius, 0],
          [0, -rock.radius * 8],
          [rock.radius, 0],
        ],
        g,
      );
      c.rotate(a);
      c.shadowColor = "#ff8a69";
      c.shadowBlur = 17;
    }
    if (rock.kind === "shear") {
      const g = c.createLinearGradient(-rock.radius * 8, 0, rock.radius, 0);
      g.addColorStop(0, "#ffe7b000");
      g.addColorStop(0.7, "#e0704866");
      g.addColorStop(1, "#f6dd9acc");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-rock.radius * (rock.drift > 0 ? 8 : -1), 0);
      c.lineTo(0, -rock.radius * 0.7);
      c.lineTo(rock.radius * (rock.drift > 0 ? 1 : -8), 0);
      c.lineTo(0, rock.radius * 0.7);
      c.fill();
    }
    c.rotate(rock.rotation);
    c.globalAlpha = rock.hit ? 0.4 : 1;
    c.drawImage(
      sprite,
      -rock.radius * 1.23,
      -rock.radius * 1.23,
      rock.radius * 2.46,
      rock.radius * 2.46,
    );
    c.restore();
  }
  well(well, time) {
    const c = this.ctx;
    c.save();
    c.translate(well.x, well.y);
    const pull = well.pull;
    const core = well.radius;
    const disc = c.createRadialGradient(0, 0, core * 0.4, 0, 0, pull);
    disc.addColorStop(0, "#000000ee");
    disc.addColorStop(0.12, "#1a1008cc");
    disc.addColorStop(0.28, "#e4b45a33");
    disc.addColorStop(0.55, "#e0704814");
    disc.addColorStop(1, "#00000000");
    c.fillStyle = disc;
    c.beginPath();
    c.arc(0, 0, pull, 0, TAU);
    c.fill();
    c.rotate(well.spin || time);
    c.strokeStyle = "#e4b45a88";
    c.lineWidth = 1.4;
    c.globalAlpha = 0.7;
    c.beginPath();
    c.ellipse(0, 0, pull * 0.42, pull * 0.14, 0.4, 0, TAU);
    c.stroke();
    c.beginPath();
    c.ellipse(0, 0, pull * 0.28, pull * 0.09, -0.2, 0, TAU);
    c.stroke();
    c.globalAlpha = 1;
    const hole = c.createRadialGradient(0, 0, 0, 0, 0, core * 1.6);
    hole.addColorStop(0, "#000");
    hole.addColorStop(0.7, "#1a0c08");
    hole.addColorStop(1, "#e4b45a66");
    c.fillStyle = hole;
    c.beginPath();
    c.arc(0, 0, core * 1.15, 0, TAU);
    c.fill();
    c.restore();
  }
  ghosts(f, reduced) {
    if (reduced || f.combo < 2 || f.status !== "playing") return;
    const c = this.ctx;
    c.save();
    c.setLineDash([4, 7]);
    c.lineWidth = 1.1;
    for (const rock of f.asteroids) {
      if (rock.destroyed || rock.hit) continue;
      const look = 0.42;
      c.strokeStyle = `rgba(228,180,90,${0.12 + f.combo * 0.04})`;
      c.beginPath();
      c.moveTo(rock.x, rock.y);
      c.lineTo(rock.x + rock.drift * look, rock.y + rock.speed * look);
      c.stroke();
    }
    c.restore();
  }
  ship(x, y, scale, lean, time, phase = false, invulnerable = false) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.rotate(lean * 0.28);
    c.scale(scale, scale);
    c.globalCompositeOperation = "lighter";
    for (const engineX of [-7.5, 7.5]) {
      const length = (phase ? 96 : 48) + Math.sin(time * 47 + engineX) * 7;
      const g = c.createLinearGradient(0, 12, 0, length);
      g.addColorStop(0, "#fff6e4");
      g.addColorStop(0.14, "#f0c878c8");
      g.addColorStop(0.5, "#e0704848");
      g.addColorStop(1, "#e0704800");
      polygon(
        c,
        [
          [engineX - 4.5, 12],
          [engineX - 3.2, length * 0.55],
          [engineX, length],
          [engineX + 3.2, length * 0.55],
          [engineX + 4.5, 12],
        ],
        g,
      );
    }
    c.globalCompositeOperation = "source-over";
    if (phase || invulnerable) {
      c.strokeStyle = phase ? "#f0c878dd" : "#ffbd94aa";
      c.lineWidth = 1.2;
      c.shadowColor = c.strokeStyle;
      c.shadowBlur = 10;
      c.beginPath();
      c.ellipse(0, 0, 32, 40, 0, 0, TAU);
      c.stroke();
      c.fillStyle = phase ? "#e4b45a10" : "#ffad7d0a";
      c.fill();
      c.shadowBlur = 0;
    }
    polygon(
      c,
      [
        [-4, -8],
        [-18, 8],
        [-26, 18],
        [-10, 12],
        [-6, 16],
      ],
      "#cfc3ae",
      "#f3ece080",
    );
    polygon(
      c,
      [
        [4, -8],
        [18, 8],
        [26, 18],
        [10, 12],
        [6, 16],
      ],
      "#6a5e4c",
      "#e8dcc480",
    );
    polygon(
      c,
      [
        [0, -34],
        [-7, -8],
        [-10, 8],
        [-6, 20],
        [0, 24],
        [6, 20],
        [10, 8],
        [7, -8],
      ],
      "#ebe3d4",
      "#f8f1e2aa",
      0.8,
    );
    polygon(
      c,
      [
        [0, -34],
        [7, -8],
        [10, 8],
        [6, 20],
        [0, 24],
        [3, 8],
        [3, -12],
      ],
      "#8a7d68",
    );
    polygon(
      c,
      [
        [0, -34],
        [-3, -12],
        [-3, 8],
        [0, 24],
        [-6, 20],
        [-10, 8],
        [-7, -8],
      ],
      "#f7f1e6",
    );
    polygon(
      c,
      [
        [0, -20],
        [4.2, -6],
        [3.4, 4],
        [0, 8],
        [-3.4, 4],
        [-4.2, -6],
      ],
      "#1a140c",
      "#e4b45a",
      1.1,
    );
    polygon(
      c,
      [
        [0, -18],
        [1.8, -6],
        [0, 4],
        [-1.8, -6],
      ],
      "#f0c878",
    );
    c.strokeStyle = "#e4b45a";
    c.lineWidth = 1.5;
    c.shadowBlur = 8;
    c.shadowColor = "#e4b45a";
    c.beginPath();
    c.moveTo(-22, 16);
    c.lineTo(-14, 11);
    c.moveTo(22, 16);
    c.lineTo(14, 11);
    c.stroke();
    c.shadowBlur = 0;
    c.restore();
  }
  pickup(p, time) {
    const c = this.ctx,
      s = p.radius / 9;
    c.save();
    c.translate(p.x, p.y);
    c.scale(s, s);
    const repair = p.type === "repair",
      color = repair ? "#e4b45a" : "#f3ece0";
    c.shadowBlur = repair ? 14 : 11;
    c.shadowColor = color;
    c.strokeStyle = color;
    c.fillStyle = color;
    if (repair) {
      c.rotate(Math.PI / 4);
      c.strokeRect(-7, -7, 14, 14);
      c.rotate(-Math.PI / 4);
      c.fillRect(-1.6, -5, 3.2, 10);
      c.fillRect(-5, -1.6, 10, 3.2);
    } else {
      c.rotate(time * 0.8);
      polygon(
        c,
        [
          [0, -10],
          [3, -3],
          [10, 0],
          [3, 3],
          [0, 10],
          [-3, 3],
          [-10, 0],
          [-3, -3],
        ],
        color,
      );
    }
    c.shadowBlur = 0;
    c.globalAlpha = 0.24;
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(0, 0, 15 + Math.sin(time * 3) * 2, 0, TAU);
    c.stroke();
    c.restore();
  }
  draw(f, time, dt, reduced = false) {
    const c = this.ctx,
      w = this.w,
      h = this.h;
    if (!w || !h) return;
    const paused = f.status === "paused",
      ed = paused ? 0 : dt;
    this.starScroll +=
      ed *
      (f.status === "ready" ? 10 : 80 + f.level * 12) *
      (f.phaseLeft && !reduced ? 4 : 1);
    c.setTransform(this.canvas.width / w, 0, 0, this.canvas.height / h, 0, 0);
    this.backdropLayer(f, time, reduced);
    c.save();
    if (this.shake && !reduced) {
      c.translate(
        Math.sin(time * 83) * this.shake,
        Math.cos(time * 61) * this.shake * 0.65,
      );
      this.shake = Math.max(0, this.shake - ed * 30);
    }
    if (f.status === "ready") {
      this.menuRocks ??= Array.from({ length: 8 }, (_, i) => ({
        x: 0,
        y: 0,
        radius: 18 + (i % 3) * 12,
        rotation: i,
        kind: i % 3 === 0 ? "iron" : i % 2 ? "cluster" : "rock",
        shape: [0.8, 0.98, 0.83, 0.95, 0.81, 0.88, 0.97, 0.84],
      }));
      for (const [i, r] of this.menuRocks.entries()) {
        r.x = w * (0.54 + (Math.sin(i * 19) + 1) * 0.2);
        r.y =
          ((i * 0.173 * h + (reduced ? 0 : time) * (8 + i)) % (h + 160)) - 80;
        r.rotation = i + time * 0.06;
        this.rock(r);
      }
      const mobile = w < 700;
      this.ship(
        w * (mobile ? 0.83 : 0.72),
        h * (mobile ? 0.13 : 0.53) + Math.sin(time * 0.8) * (reduced ? 0 : 9),
        mobile ? 1.25 : clamp(h / 190, 2, 4),
        -1.1,
        time,
      );
    } else {
      for (const well of f.wells || []) this.well(well, time);
      for (const warning of f.warnings) {
        const alpha = 0.15 + 0.4 * (1 - warning.left / warning.duration);
        c.save();
        c.strokeStyle = `rgba(224,112,72,${alpha})`;
        c.lineWidth = 1.5;
        c.setLineDash([8, 10]);
        c.lineDashOffset = -time * 35;
        c.beginPath();
        if (warning.axis === "h") {
          c.moveTo(0, warning.y);
          c.lineTo(w, warning.y);
        } else {
          c.moveTo(warning.x, 0);
          c.lineTo(warning.endX, h);
        }
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = "#ffae8e";
        c.font = "bold 18px sans-serif";
        c.textAlign = "center";
        if (warning.axis === "h") c.fillText("!", 28, warning.y + 6);
        else c.fillText("!", warning.x, 30);
        c.restore();
      }
      this.ghosts(f, reduced);
      if (!paused && f.status === "playing") {
        this.trail.push({ x: f.player.x, y: f.player.y + 12 * f.scale });
        if (this.trail.length > 22) this.trail.shift();
      }
      if (!reduced && this.trail.length > 1 && f.status !== "over") {
        c.lineCap = "round";
        for (let i = 1; i < this.trail.length; i++) {
          c.strokeStyle = `rgba(228,180,90,${(i / this.trail.length) * 0.18})`;
          c.lineWidth = (i / this.trail.length) * 10 * f.scale;
          c.beginPath();
          c.moveTo(
            this.trail[i - 1].x,
            this.trail[i - 1].y + (this.trail.length - i) * 3,
          );
          c.lineTo(
            this.trail[i].x,
            this.trail[i].y + (this.trail.length - i - 1) * 3,
          );
          c.stroke();
        }
      }
      for (const p of f.pickups) this.pickup(p, time);
      for (const r of f.asteroids) this.rock(r);
      if (f.status !== "over")
        this.ship(
          f.player.x,
          f.player.y,
          f.scale,
          f.player.lean,
          time,
          f.phaseLeft > 0,
          f.invulnerable > 0,
        );
    }
    for (const r of this.rings) {
      r.life -= ed;
      r.r += ed * 210 * f.scale;
      c.globalAlpha = Math.max(0, r.life);
      c.strokeStyle = r.color;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(r.x, r.y, r.r, 0, TAU);
      c.stroke();
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    c.globalAlpha = 1;
    for (const p of this.particles) {
      p.life -= ed;
      p.x += p.vx * ed;
      p.y += p.vy * ed;
      p.vx *= Math.exp(-ed * 2);
      p.vy *= Math.exp(-ed * 2);
      c.globalAlpha = clamp(p.life * 2, 0, 1);
      c.fillStyle = p.color;
      c.fillRect(p.x, p.y, p.size, p.size);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    c.globalAlpha = 1;
    for (const l of this.labels) {
      l.life -= ed;
      l.y -= ed * 32;
      c.globalAlpha = clamp(l.life * 2, 0, 1);
      c.textAlign = "center";
      c.font = `600 ${Math.max(10, 12 * f.scale)}px "IBM Plex Mono", monospace`;
      c.fillStyle = l.color;
      c.fillText(l.text, clamp(l.x, 85, w - 85), l.y);
    }
    this.labels = this.labels.filter((l) => l.life > 0);
    c.globalAlpha = 1;
    c.restore();
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - ed * 1.4);
      c.strokeStyle = `rgba(224,112,72,${this.flash})`;
      c.lineWidth = 10;
      c.strokeRect(0, 0, w, h);
    }
  }
}
